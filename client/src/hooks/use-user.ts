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

interface AuthResult {
  ok: boolean;
  message?: string;
  field?: string;
  errors?: Record<string, string[]>;
  user?: User;
}

export function useUser() {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: false,
    error: null
  });

  const { 
    data: user, 
    error: swrError, 
    isLoading: swrLoading, 
    mutate 
  } = useSWR<User>("/api/user", {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
    dedupingInterval: 0,
    onError: () => {
      console.log('[Auth] Session validation failed, clearing user data');
      mutate(undefined, false);
    }
  });

  const login = useCallback(async (credentials: InsertUser): Promise<AuthResult> => {
    if (authState.isLoading) {
      return { ok: false, message: "ログイン処理中です" };
    }

    try {
      setAuthState({ isLoading: true, error: null });

      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        const error = {
          message: data.message || "ログインに失敗しました",
          field: data.field,
          errors: data.errors,
        };
        setAuthState({
          isLoading: false,
          error
        });
        return { ok: false, ...error };
      }

      await mutate();
      return { ok: true, user: data.user };
    } catch (e: any) {
      const error = {
        message: "サーバーとの通信に失敗しました",
        field: "network",
      };
      setAuthState({
        isLoading: false,
        error
      });
      return { ok: false, ...error };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.isLoading, mutate]);

  const logout = useCallback(async (): Promise<AuthResult> => {
    if (authState.isLoading) {
      return { ok: false, message: "ログアウト処理中です" };
    }

    try {
      setAuthState({ isLoading: true, error: null });
      
      const response = await fetch("/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = { message: "ログアウトに失敗しました" };
        setAuthState({
          isLoading: false,
          error
        });
        return { ok: false, ...error };
      }

      await mutate(undefined, false);
      return { ok: true };
    } catch (e: any) {
      const error = { message: "サーバーとの通信に失敗しました" };
      setAuthState({
        isLoading: false,
        error
      });
      return { ok: false, ...error };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.isLoading, mutate]);

  return {
    user,
    isLoading: swrLoading || authState.isLoading,
    isLoginPending: authState.isLoading,
    isAuthenticated: !!user,
    error: authState.error || (swrError ? { message: "認証に失敗しました" } : null),
    login,
    logout
  };
}
