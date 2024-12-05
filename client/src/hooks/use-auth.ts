import useSWR from "swr";
import { useCallback } from "react";
import { useLocation } from "wouter";

interface User {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
}

interface LoginCredentials {
  username: string;
  password: string;
}

export function useAuth() {
  const { data: user, error, mutate } = useSWR<User>("/api/auth/session", {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 0,
    fallbackData: null,
    fetcher: async (url) => {
      const response = await fetch(url, {
        credentials: "include"
      });
      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        throw new Error("認証に失敗しました");
      }
      return response.json();
    }
  });
  const [, setLocation] = useLocation();

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include"
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "ログインに失敗しました");
      }

      const data = await response.json();
      await mutate();
      return data;
    } catch (error) {
      throw error;
    }
  }, [mutate]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await mutate(null);
      setLocation("/admin/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }, [mutate, setLocation]);

  return {
    user,
    isLoading: !error && !user,
    error,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin"
  };
}
