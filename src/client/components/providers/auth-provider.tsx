"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import apiClient from "@/lib/api/client";
import type { User, UserPermission } from "@/types/user";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
  hasPermission: (permission: UserPermission | UserPermission[], requireAll?: boolean) => boolean;
}

interface AuthResponse {
  user: User;
  token: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizePermissions = (permission: UserPermission | UserPermission[]) =>
  Array.isArray(permission) ? permission : [permission];

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const handlingUnauthorizedRef = useRef(false);


  const fetchCurrentUser = useCallback(async () => {
    try {
      const { data } = await apiClient.get<{ user: User }>("/auth/me", {
        headers: { "x-skip-auth-redirect": "true" }
      });
      setUser(data.user);
      return data.user;
    } catch (error: any) {
      if (error?.response?.status !== 401) {
        console.error("Failed to fetch current user", error);
      }
      setUser(null);
      return null;
    }
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    await fetchCurrentUser();
    setLoading(false);
  }, [fetchCurrentUser]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const handleUnauthorized = useCallback(() => {
    // Prevent multiple simultaneous calls
    if (handlingUnauthorizedRef.current) {
      return;
    }
    
    handlingUnauthorizedRef.current = true;
    void apiClient.post("/auth/logout").catch(() => undefined);
    setUser(null);
    setLoading(false);
    toast.error("Your session has expired. Please sign in again.");
    router.replace("/auth/login");
    
    // Reset after a delay to allow for potential re-authentication
    setTimeout(() => {
      handlingUnauthorizedRef.current = false;
    }, 1000);
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.addEventListener("auth:unauthorized", handleUnauthorized);
      return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
    }

    return undefined;
  }, [handleUnauthorized]);

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      setLoading(true);
      try {
        const { data } = await apiClient.post<AuthResponse>("/auth/login", credentials);
        setUser(data.user);
        return data.user;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    void apiClient.post("/auth/logout").catch((error) => {
      console.error("Failed to log out", error);
    });
    setUser(null);
    router.replace("/auth/login");
  }, [router]);

  const refresh = useCallback(async () => {
    await fetchCurrentUser();
  }, [fetchCurrentUser]);

  const hasPermission = useCallback(
    (permission: UserPermission | UserPermission[], requireAll = false) => {
      if (!user) {
        return false;
      }
      const permissions = normalizePermissions(permission);
      if (!permissions.length) {
        return true;
      }
      if (requireAll) {
        return permissions.every((candidate) => user.permissions.includes(candidate));
      }
      return permissions.some((candidate) => user.permissions.includes(candidate));
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refresh,
      hasPermission
    }),
    [user, loading, login, logout, refresh, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
