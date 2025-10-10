"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

  const persistToken = useCallback((token: string | null) => {
    if (typeof window === "undefined") {
      return;
    }
    if (token) {
      window.localStorage.setItem("authToken", token);
    } else {
      window.localStorage.removeItem("authToken");
    }
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    if (typeof window === "undefined") {
      return null;
    }
    const token = window.localStorage.getItem("authToken");
    if (!token) {
      setUser(null);
      return null;
    }

    try {
      const { data } = await apiClient.get<{ user: User }>("/auth/me");
      setUser(data.user);
      return data.user;
    } catch (error) {
      console.error("Failed to fetch current user", error);
      persistToken(null);
      setUser(null);
      return null;
    }
  }, [persistToken]);

  const initialize = useCallback(async () => {
    setLoading(true);
    await fetchCurrentUser();
    setLoading(false);
  }, [fetchCurrentUser]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const handleUnauthorized = () => {
      persistToken(null);
      setUser(null);
      setLoading(false);
      toast.error("Your session has expired. Please sign in again.");
      router.replace("/login");
    };

    if (typeof window !== "undefined") {
      window.addEventListener("auth:unauthorized", handleUnauthorized);
      return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
    }

    return undefined;
  }, [persistToken, router]);

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      setLoading(true);
      try {
        const { data } = await apiClient.post<AuthResponse>("/auth/login", credentials);
        persistToken(data.token);
        setUser(data.user);
        return data.user;
      } finally {
        setLoading(false);
      }
    },
    [persistToken]
  );

  const logout = useCallback(() => {
    persistToken(null);
    setUser(null);
    router.replace("/login");
  }, [persistToken, router]);

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
