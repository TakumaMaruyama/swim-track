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

interface ApiResponse<T = any> {
  ok: boolean;
  message?: string;
  user?: T;
}

export function useAuth() {
  const { data, error, mutate } = useSWR<ApiResponse<User>>("/api/auth/session");
  const [, setLocation] = useLocation();

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      const data = await response.json();
      
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "ログインに失敗しました");
      }

      await mutate(data);
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("ログインに失敗しました");
    }
  }, [mutate]);

  const logout = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/logout", { 
        method: "POST",
        credentials: "include"
      });

      const data = await response.json();
      
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "ログアウトに失敗しました");
      }

      await mutate(null);
      setLocation("/admin/login");
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }, [mutate, setLocation]);

  return {
    user: data?.user,
    isLoading: !error && !data,
    error,
    login,
    logout,
    isAuthenticated: !!data?.user,
    isAdmin: data?.user?.role === "admin"
  };
}
