import useSWR from "swr";
import { useCallback } from "react";
import { useLocation } from "wouter";

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
  credentialState: "setup_required" | "temporary" | "active";
  mustChangePassword?: boolean;
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
  state?: string;
  mustChangePassword?: boolean;
  requiresPasswordSetup?: boolean;
  credentialState?: "setup_required" | "temporary" | "active";
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

  const athleteStart = useCallback((fullName: string) =>
    postAuth("/api/auth/athlete/start", { fullName }), [postAuth]);

  const athleteLogin = useCallback(async (fullName: string, password: string) => {
    const result = await postAuth("/api/auth/athlete/login", { fullName, password });
    await mutate(result, false);
    return result;
  }, [mutate, postAuth]);

  const setupPassword = useCallback(async (
    password: string,
    passwordConfirmation: string,
  ) => {
    const result = await postAuth("/api/auth/athlete/password", {
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
    const result = await postAuth("/api/auth/athlete/password", {
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
    athleteStart,
    athleteLogin,
    setupPassword,
    changePassword,
    logout,
    isAuthenticated: !!data?.user,
    isAdmin: data?.user?.role === "admin",
    mustChangePassword: Boolean(
      data?.credentialState === "temporary" ||
      data?.user?.credentialState === "temporary" ||
      data?.mustChangePassword ||
      data?.user?.mustChangePassword
    ),
  };
}
