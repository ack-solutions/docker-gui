"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getCurrentUser, isAuthenticated, type PublicUser } from "@/lib/v2/auth-client";
import { LoadingState } from "./loading-state";

export interface AuthGuardProps {
  children: (user: PublicUser) => JSX.Element;
  loginPath?: string;
}

/**
 * Render-prop wrapper that:
 *   1. Redirects to /login?next=<current> if no token
 *   2. Verifies token by calling /auth/me
 *   3. Passes the fetched user to children
 *
 * Usage:
 *   <AuthGuard>{(user) => <ContainersPage user={user} />}</AuthGuard>
 *
 * Pages that need a logged-in user should always go through AuthGuard so
 * the auth check is identical everywhere.
 */
export function AuthGuard({ children, loginPath = "/login" }: AuthGuardProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [user, setUser] = useState<PublicUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const next = encodeURIComponent(pathname);

    if (!isAuthenticated()) {
      router.replace(`${loginPath}?next=${next}`);
      return;
    }
    getCurrentUser()
      .then((u) => {
        if (cancelled) return;
        if (!u) {
          router.replace(`${loginPath}?next=${next}`);
        } else {
          setUser(u);
          setChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router, pathname, loginPath]);

  if (!checked || !user) {
    return <LoadingState fullScreen message="Checking session…" />;
  }
  return children(user);
}
