import useSWR from "swr";
import type { User, InsertUser } from "db/schema";
import { useCallback, useState } from "react";

interface AuthError {
  message: string;
  field?: string;
  errors?: Record<string, string[]>;
}

interface AuthResult {
  ok: boolean;
  message?: string;
  field?: string;
  errors?: Record<string, string[]>;
  user?: User;
}

export function useUser() {
  const [authState, setAuthState] = useState<{
    isLoading: boolean;
    error: AuthError | null;
  }>({
    isLoading: false,
    error: null
  });

  const { 
    data: user, 
    error: swrError, 
    isLoading: swrLoading, 
    mutate 
  } = useSWR<User>("/api/user", {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    shouldRetryOnError: true,
    errorRetryCount: 3,
    dedupingInterval: 5000,
    onError: (error) => {
      if (error.message.includes('Not logged in') || error.message.includes('認証が必要です')) {
        mutate(undefined, { revalidate: false });
      }
    }
  });

  const handleAuthRequest = useCallback(async (
    url: string,
    method: string,
    body?: any
  ): Promise<AuthResult> => {
    if (authState.isLoading) {
      return { ok: false, message: "処理中です" };
    }

    try {
      setAuthState({ isLoading: true, error: null });
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        const error = {
          message: data.message || "エラーが発生しました",
          field: data.field,
          errors: data.errors,
        };
        setAuthState({ isLoading: false, error });
        return { ok: false, ...error };
      }

      await mutate(data.user, false);
      return { ok: true, user: data.user };
    } catch (error) {
      const errorMessage = { 
        message: "サーバーとの通信に失敗しました",
        field: "network",
      };
      setAuthState({ isLoading: false, error: errorMessage });
      return { ok: false, ...errorMessage };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.isLoading, mutate]);

  const login = useCallback((credentials: InsertUser) => {
    return handleAuthRequest("/login", "POST", credentials);
  }, [handleAuthRequest]);

  const register = useCallback((userData: InsertUser) => {
    return handleAuthRequest("/register", "POST", userData);
  }, [handleAuthRequest]);

  const logout = useCallback(() => {
    return handleAuthRequest("/logout", "POST");
  }, [handleAuthRequest]);

  return {
    user,
    isLoading: swrLoading || authState.isLoading,
    isLoginPending: authState.isLoading,
    isAuthenticated: !!user,
    error: authState.error || (swrError ? { message: "認証に失敗しました" } : null),
    register,
    login,
    logout,
  };
}