import { NextResponse } from "next/server";
import { AuthError, AUTH_COOKIE_NAME, authService } from "@/server/auth/auth-service";
import type { User, UserPermission } from "@/types/user";

export class AuthorizationError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = "AuthorizationError";
  }
}

const normalize = (permission: UserPermission | UserPermission[]): UserPermission[] =>
  Array.isArray(permission) ? permission : [permission];

export const userHasPermission = (user: User, permission: UserPermission | UserPermission[], requireAll = false) => {
  const permissions = normalize(permission);
  if (permissions.length === 0) {
    return true;
  }

  if (requireAll) {
    return permissions.every((candidate) => user.permissions.includes(candidate));
  }

  return permissions.some((candidate) => user.permissions.includes(candidate));
};

export const getTokenFromRequest = (request: Request): string => {
  const authorizationHeader =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");

  if (authorizationHeader?.startsWith("Bearer ")) {
    const token = authorizationHeader.slice(7).trim();
    if (token) {
      return token;
    }
  }

  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((part) => {
        const [key, ...rest] = part.trim().split("=");
        return [key, rest.join("=")];
      })
    );
    const token = cookies[AUTH_COOKIE_NAME];
    if (token) {
      return decodeURIComponent(token);
    }
  }

  throw new AuthorizationError("Authentication token is required.", 401);
};

export const requireUser = async (
  request: Request,
  permission?: UserPermission | UserPermission[],
  requireAll = false
): Promise<User> => {
  const token = getTokenFromRequest(request);
  const user = await authService.verify(token);

  if (permission && !userHasPermission(user, permission, requireAll)) {
    throw new AuthorizationError("You do not have permission to perform this action.", 403);
  }

  return user;
};

type WithAuthOptions = {
  permission?: UserPermission | UserPermission[];
  requireAll?: boolean;
};

type WithAuthHandler<Context> = (request: Request, context: Context, user: User) => Promise<Response> | Response;

export const withAuth =
  <Context = unknown>(handler: WithAuthHandler<Context>, options: WithAuthOptions = {}) =>
  async (request: Request, context: Context) => {
    try {
      const user = await requireUser(request, options.permission, options.requireAll ?? false);
      return await handler(request, context, user);
    } catch (error) {
      if (error instanceof AuthorizationError || error instanceof AuthError) {
        return NextResponse.json({ message: error.message }, { status: error.statusCode ?? 401 });
      }

      console.error("Failed to process authenticated request", error);
      return NextResponse.json({ message: "Internal server error." }, { status: 500 });
    }
  };
