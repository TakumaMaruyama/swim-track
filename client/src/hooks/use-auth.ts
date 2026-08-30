import useSWR from "swr";
import { useCallback } from "react";
import { useLocation } from "wouter";

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  passwordState?: string;
  authState?: string;
}

interface LoginCredentials {
  username?: string;
  fullName?: string;
  password: string;
}

export interface AuthResponse<T = AuthUser> {
  ok: boolean;
  message?: string;
  user?: T;
  status?: string;
  authState?: string;
  state?: string;
  mustChangePassword?: boolean;
  requiresPasswordSetup?: boolean;
}

export function useAuth() {
  const { data, error, mutate } = useSWR<AuthResponse | null>("/api/auth/session");
  const [, setLocation] = useLocation();

  const postAuth = useCallback(async (url: string, body: object) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    const result = await response.json().catch(() => ({})) as AuthResponse;
    if (!response.ok || !result.ok) {
      throw new Error(result.message || "認証に失敗しました");
    }
    return result;
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const result = await postAuth("/api/auth/login", credentials);
    await mutate(result, false);
    return result;
  }, [mutate, postAuth]);

  const identify = useCallback((fullName: string) =>
    postAuth("/api/auth/identity-check", { fullName }), [postAuth]);

  const setupPassword = useCallback(async (
    fullName: string,
    password: string,
    passwordConfirmation: string,
  ) => {
    const result = await postAuth("/api/auth/setup-password", {
      fullName,
      password,
      passwordConfirmation,
    });
    await mutate(result, false);
    return result;
  }, [mutate, postAuth]);

  const changePassword = useCallback(async (
    password: string,
    passwordConfirmation: string,
  ) => {
    const result = await postAuth("/api/auth/change-password", {
      password,
      passwordConfirmation,
    });
    await mutate(result, false);
    return result;
  }, [mutate, postAuth]);

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

       await mutate(null, false);
       setLocation("/login");
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }, [mutate, setLocation]);

  return {
    user: data?.user,
    isLoading: !error && data === undefined,
    error,
    login,
    identify,
    setupPassword,
    changePassword,
    logout,
    isAuthenticated: !!data?.user,
    isAdmin: data?.user?.role === "admin",
    mustChangePassword: Boolean(
      data?.mustChangePassword ||
      data?.user?.mustChangePassword ||
      data?.state === "temp_password" ||
      data?.authState === "temporary_password" ||
      data?.user?.authState === "temp_password" ||
      data?.user?.passwordState === "temporary"
    ),
  };
}
