"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ensureFreshToken } from "./auth-client";

interface LogMessage {
  kind: "meta" | "log" | "error";
  stream?: "stdout" | "stderr";
  text?: string;
  message?: string;
}

export interface LogLine {
  id: number;
  stream: "stdout" | "stderr";
  text: string;
}

export type LogStreamStatus =
  | "connecting"
  | "connected"
  | "ended"
  | "error"
  | "closed"
  | "auth-expired";

/** WebSocket tagged with the generation that created it, so handlers from a
 *  superseded connection can detect they're stale and bail. */
interface GenWebSocket extends WebSocket {
  __gen?: number;
}

function buildWsUrl(containerId: string, tail: number, accessToken: string): string | null {
  if (typeof window === "undefined") return null;
  const base = process.env.NEXT_PUBLIC_API_URL ?? window.location.origin;
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/api/v1/ws/logs/${encodeURIComponent(containerId)}`;
  url.searchParams.set("token", accessToken);
  url.searchParams.set("tail", String(tail));
  return url.toString();
}

export interface UseContainerLogStreamOptions {
  /** Hard cap on retained lines (oldest dropped). Default 1500 (embedded). */
  maxLines?: number;
  /** Initial backlog requested from the server. Default 200. */
  tail?: number;
  /** When false the socket is closed and buffering stops (e.g. collapsed). */
  enabled?: boolean;
}

export interface ContainerLogStream {
  lines: LogLine[];
  status: LogStreamStatus;
  error: string | null;
  paused: boolean;
  bufferedCount: number;
  counts: { stdout: number; stderr: number };
  setPaused: (next: boolean | ((prev: boolean) => boolean)) => void;
  clear: () => void;
  reconnect: () => void;
}

/**
 * The single Docker-log WebSocket implementation, shared by the full-page live
 * logs view and the docked log drawer. Folds three fixes the old inline version
 * lacked: (1) refreshes the access token before opening the socket and once on
 * an unexpected close — terminal `auth-expired` rather than a stale-token loop;
 * (2) a per-connect generation guard so a slow CONNECTING socket from a previous
 * container can't resurrect itself after we've moved on; (3) the buffered-while-
 * paused count is real React state, not a ref read that never re-renders.
 */
export function useContainerLogStream(
  containerId: string,
  options: UseContainerLogStreamOptions = {},
): ContainerLogStream {
  const maxLines = options.maxLines ?? 1500;
  const tail = options.tail ?? 200;
  const enabled = options.enabled ?? true;

  const [lines, setLines] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<LogStreamStatus>(enabled ? "connecting" : "closed");
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [bufferedCount, setBufferedCount] = useState(0);

  const wsRef = useRef<GenWebSocket | null>(null);
  const genRef = useRef(0);
  const idRef = useRef(0);
  const pausedRef = useRef(false);
  const bufferedRef = useRef<LogLine[]>([]);
  const endedRef = useRef(false);
  const fatalRef = useRef(false);
  const triedRefreshRef = useRef(false);
  pausedRef.current = paused;

  const appendLines = useCallback(
    (incoming: LogLine[]) => {
      if (incoming.length === 0) return;
      setLines((prev) => {
        const merged = prev.concat(incoming);
        return merged.length > maxLines ? merged.slice(merged.length - maxLines) : merged;
      });
    },
    [maxLines],
  );

  const connect = useCallback(async () => {
    // Claim a new generation and tear down any existing socket. Its handlers
    // (gen = previous) will see genRef.current has moved and bail.
    const old = wsRef.current;
    wsRef.current = null;
    const myGen = ++genRef.current;
    if (old && old.readyState <= 1) {
      try {
        old.close();
      } catch {
        /* ignore */
      }
    }

    setStatus("connecting");
    setError(null);

    const fresh = await ensureFreshToken();
    if (myGen !== genRef.current) return; // superseded while awaiting refresh
    if (!fresh) {
      setStatus("auth-expired");
      setError("Session expired — sign in again.");
      return;
    }

    const url = buildWsUrl(containerId, tail, fresh.accessToken);
    if (!url) {
      setStatus("error");
      setError("Cannot build log stream URL");
      return;
    }

    const ws = new WebSocket(url) as GenWebSocket;
    ws.__gen = myGen;
    wsRef.current = ws;

    ws.onopen = () => {
      if (myGen !== genRef.current) return;
      triedRefreshRef.current = false;
      setStatus("connected");
    };

    ws.onmessage = (e) => {
      if (myGen !== genRef.current) return;
      let parsed: LogMessage;
      try {
        parsed = JSON.parse(typeof e.data === "string" ? e.data : "") as LogMessage;
      } catch {
        return;
      }
      if (parsed.kind === "error" && parsed.message) {
        fatalRef.current = true;
        setError(parsed.message);
        setStatus("error");
        return;
      }
      if (parsed.kind === "log" && parsed.text !== undefined) {
        const stream = parsed.stream ?? "stdout";
        const text = parsed.text;
        const next: LogLine[] = [];
        for (const segment of text.split(/\r?\n/)) {
          if (!segment && !text.endsWith("\n")) continue;
          next.push({ id: ++idRef.current, stream, text: segment });
        }
        if (next.length === 0) return;
        if (pausedRef.current) {
          bufferedRef.current.push(...next);
          if (bufferedRef.current.length > maxLines) {
            bufferedRef.current.splice(0, bufferedRef.current.length - maxLines);
          }
          setBufferedCount(bufferedRef.current.length);
        } else {
          appendLines(next);
        }
      }
      if (parsed.kind === "meta" && parsed.message === "stream ended") {
        endedRef.current = true;
        setStatus("ended");
      }
    };

    ws.onerror = () => {
      if (myGen !== genRef.current) return;
      setError("WebSocket error");
    };

    ws.onclose = () => {
      if (myGen !== genRef.current) return;
      wsRef.current = null;
      if (endedRef.current) {
        setStatus("ended");
        return;
      }
      if (fatalRef.current) {
        setStatus("error");
        return;
      }
      // Unexpected close — most often a token that expired mid-stream. Try one
      // refresh+reconnect (connect() re-checks the token); never loop.
      if (!triedRefreshRef.current) {
        triedRefreshRef.current = true;
        setStatus("connecting");
        void connect();
        return;
      }
      setStatus("closed");
    };
  }, [containerId, tail, maxLines, appendLines]);

  // Open / tear down with the container + enabled flag.
  useEffect(() => {
    if (!enabled) {
      const ws = wsRef.current;
      wsRef.current = null;
      genRef.current += 1;
      if (ws && ws.readyState <= 1) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
      bufferedRef.current = [];
      setBufferedCount(0);
      setStatus("closed");
      return;
    }
    endedRef.current = false;
    fatalRef.current = false;
    triedRefreshRef.current = false;
    void connect();
    return () => {
      const ws = wsRef.current;
      wsRef.current = null;
      genRef.current += 1;
      if (ws && ws.readyState <= 1) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, [enabled, connect]);

  // Flush buffered lines into the visible list on resume.
  useEffect(() => {
    if (paused) return;
    if (bufferedRef.current.length === 0) return;
    const flushed = bufferedRef.current;
    bufferedRef.current = [];
    setBufferedCount(0);
    appendLines(flushed);
  }, [paused, appendLines]);

  const clear = useCallback(() => {
    setLines([]);
    bufferedRef.current = [];
    setBufferedCount(0);
    idRef.current = 0;
  }, []);

  const reconnect = useCallback(() => {
    setLines([]);
    setError(null);
    bufferedRef.current = [];
    setBufferedCount(0);
    endedRef.current = false;
    fatalRef.current = false;
    triedRefreshRef.current = false;
    void connect();
  }, [connect]);

  const counts = useMemo(() => {
    let stdout = 0;
    let stderr = 0;
    for (const l of lines) {
      if (l.stream === "stderr") stderr += 1;
      else stdout += 1;
    }
    return { stdout, stderr };
  }, [lines]);

  return { lines, status, error, paused, bufferedCount, counts, setPaused, clear, reconnect };
}
