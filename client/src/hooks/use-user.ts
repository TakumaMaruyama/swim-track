import useSWR from "swr";
import type { User, InsertUser } from "db/schema";
import { useCallback, useState } from "react";

interface AuthError {
  message: string;
  field?: string;
  errors?: Record<string, string[]>;
}

interface AuthState {
  isLoading: boolean;
  error: AuthError | null;
}

export function useUser() {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: false,
    error: null,
  });

  const { 
    data, 
    error: swrError, 
    isLoading: swrLoading, 
    mutate 
  } = useSWR<User>("/api/user", {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    shouldRetryOnError: false,
    refreshInterval: 300000, // Refresh session every 5 minutes
    onError: () => {
      // Clear user data on error
      mutate(undefined, false);
    }
  });

  const login = useCallback(async (user: InsertUser) => {
    if (authState.isLoading) {
      return { ok: false, message: "ログイン処理中です" };
    }

    try {
      setAuthState({ isLoading: true, error: null });
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthState({
          isLoading: false,
          error: {
            message: data.message || "ログインに失敗しました",
            field: data.field,
            errors: data.errors,
          },
        });
        return { ok: false, message: data.message, field: data.field, errors: data.errors };
      }

      await mutate();
      setAuthState({ isLoading: false, error: null });
      return { ok: true, user: data.user };
    } catch (e: any) {
      const error = {
        message: "サーバーとの通信に失敗しました",
        field: "network",
      };
      setAuthState({ isLoading: false, error });
      return { ok: false, ...error };
    }
  }, [authState.isLoading, mutate]);

  const logout = useCallback(async () => {
    if (authState.isLoading) {
      return { ok: false, message: "ログアウト処理中です" };
    }

    try {
      setAuthState({ isLoading: true, error: null });
      const response = await fetch("/logout", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthState({
          isLoading: false,
          error: { message: data.message || "ログアウトに失敗しました" },
        });
        return { ok: false, message: data.message };
      }

      // Clear user data and reset state
      await mutate(undefined, false);
      setAuthState({ isLoading: false, error: null });
      return { ok: true };
    } catch (e: any) {
      const error = { message: "サーバーとの通信に失敗しました" };
      setAuthState({ isLoading: false, error });
      return { ok: false, ...error };
    }
  }, [authState.isLoading, mutate]);

  const register = useCallback(async (user: InsertUser) => {
    if (authState.isLoading) {
      return { ok: false, message: "登録処理中です" };
    }

    try {
      setAuthState({ isLoading: true, error: null });
      const response = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthState({
          isLoading: false,
          error: {
            message: data.message || "登録に失敗しました",
            field: data.field,
            errors: data.errors,
          },
        });
        return { ok: false, message: data.message, field: data.field, errors: data.errors };
      }

      await mutate();
      setAuthState({ isLoading: false, error: null });
      return { ok: true, user: data.user };
    } catch (e: any) {
      const error = {
        message: "サーバーとの通信に失敗しました",
        field: "network",
      };
      setAuthState({ isLoading: false, error });
      return { ok: false, ...error };
    }
  }, [authState.isLoading, mutate]);

  return {
    user: data,
    isLoading: swrLoading || authState.isLoading,
    isLoginPending: authState.isLoading,
    isAuthenticated: !!data,
    error: authState.error || (swrError ? { message: "認証に失敗しました" } : null),
    login,
    logout,
    register,
  };
}
