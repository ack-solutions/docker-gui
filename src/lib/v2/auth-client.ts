/**
 * Client-side auth + API helpers for the v2 architecture.
 *
 * - Stores access + refresh tokens in localStorage under `dgui.v2.tokens`
 * - `apiFetch` wraps fetch, attaches the Authorization header, and on 401
 *   transparently refreshes the access token using the refresh token.
 *   If refresh fails, tokens are cleared and the caller's promise rejects.
 */

const TOKENS_KEY = "dgui.v2.tokens";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface StoredTokens {
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "operator" | "viewer" | string;
  isActive: boolean;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getTokens(): StoredTokens | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(TOKENS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed &&
      typeof parsed.accessToken === "string" &&
      typeof parsed.refreshToken === "string"
    ) {
      return parsed as StoredTokens;
    }
    return null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: StoredTokens): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(TOKENS_KEY);
}

export function isAuthenticated(): boolean {
  const t = getTokens();
  if (!t) return false;
  // Treat as authed even if access token is expiring — we'll refresh on first use
  return new Date(t.refreshExpiresAt).getTime() > Date.now();
}

async function refreshAccessToken(): Promise<StoredTokens | null> {
  const stored = getTokens();
  if (!stored) return null;
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: stored.refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const body = await res.json();
    const next: StoredTokens = body.data;
    setTokens(next);
    return next;
  } catch {
    return null;
  }
}

/**
 * Return tokens that are safe to use right now, refreshing first if the access
 * token is expired or within `skewMs` of expiring. Unlike `apiFetch`, the
 * WebSocket path can't retry on a 401 — it must open with a valid token — so
 * the log-stream hook calls this before building the ws URL.
 */
export async function ensureFreshToken(skewMs = 30_000): Promise<StoredTokens | null> {
  const stored = getTokens();
  if (!stored) return null;
  const expiresAt = Date.parse(stored.accessExpiresAt);
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > skewMs) return stored;
  return refreshAccessToken();
}

export interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  /** Skip auth attachment (for /auth/login etc.) */
  skipAuth?: boolean;
}

export async function apiFetch<T = unknown>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const { skipAuth, headers: baseHeaders, ...rest } = opts;
  const tokens = skipAuth ? null : getTokens();

  // Only declare a JSON content-type when we are actually sending a body.
  // Fastify rejects an empty body with 400 when content-type is set to
  // application/json — that would break every bodiless POST (feature
  // enable/disable, container start/stop, connection verify, …). Let the
  // caller override via `headers` if they need something else.
  const hasBody = rest.body !== undefined && rest.body !== null;
  const headers: Record<string, string> = {
    ...(hasBody ? { "content-type": "application/json" } : {}),
    ...baseHeaders,
    ...(tokens ? { authorization: `Bearer ${tokens.accessToken}` } : {}),
  };

  let res = await fetch(url, { ...rest, headers });

  // On 401, attempt a single transparent refresh
  if (res.status === 401 && !skipAuth && tokens) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers["authorization"] = `Bearer ${refreshed.accessToken}`;
      res = await fetch(url, { ...rest, headers });
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let body: unknown = undefined;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = await res.json().catch(() => undefined);
  }

  if (!res.ok) {
    const err = body as Partial<ApiErrorBody> | undefined;
    const code = err?.error?.code ?? "unknown_error";
    const message = err?.error?.message ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, code, message, err?.error?.details);
  }

  // Success envelopes are inconsistent across the API: most routes wrap in
  // `{ data: ... }`, but several (storage, registry, databases, alerts,
  // features) return the value directly. Unwrap `{ data }` when present,
  // otherwise return the body as-is, so every page gets its payload.
  if (body && typeof body === "object" && "data" in (body as Record<string, unknown>)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export async function login(email: string, password: string): Promise<{ user: PublicUser; tokens: StoredTokens }> {
  const data = await apiFetch<StoredTokens & { user: PublicUser }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
  const tokens: StoredTokens = {
    accessToken: data.accessToken,
    accessExpiresAt: data.accessExpiresAt,
    refreshToken: data.refreshToken,
    refreshExpiresAt: data.refreshExpiresAt,
  };
  setTokens(tokens);
  return { user: data.user, tokens };
}

export async function logout(): Promise<void> {
  const tokens = getTokens();
  if (tokens) {
    try {
      await apiFetch("/api/v1/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        skipAuth: true,
      });
    } catch {
      // best-effort; we still clear locally below
    }
  }
  clearTokens();
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  try {
    const data = await apiFetch<{ user: PublicUser }>("/api/v1/auth/me");
    return data.user;
  } catch {
    return null;
  }
}
