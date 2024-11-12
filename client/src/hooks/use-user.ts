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
    error: null
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
    refreshInterval: 300000,
    onError: () => {
      console.log('[Auth] Session validation failed, clearing user data');
      mutate(undefined, false);
    }
  });

  const login = useCallback(async (user: InsertUser) => {
    if (authState.isLoading) {
      console.log('[Auth] Login already in progress');
      return { ok: false, message: "ログイン処理中です" };
    }

    try {
      console.log('[Auth] Starting login attempt');
      setAuthState({ isLoading: true, error: null });

      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        console.log('[Auth] Login failed:', data.message);
        setAuthState({
          isLoading: false,
          error: {
            message: data.message || "ログインに失敗しました",
            field: data.field,
            errors: data.errors,
          }
        });
        return { ok: false, message: data.message, field: data.field, errors: data.errors };
      }

      console.log('[Auth] Login successful, forcing immediate navigation');
      await mutate();
      // Force a page reload to ensure fresh session
      window.location.replace('/');
      return { ok: true, user: data.user };
    } catch (e: any) {
      console.error('[Auth] Login error:', e);
      const error = {
        message: "サーバーとの通信に失敗しました",
        field: "network",
      };
      setAuthState({
        isLoading: false,
        error
      });
      return { ok: false, ...error };
    }
  }, [authState.isLoading, mutate]);

  const logout = useCallback(async () => {
    if (authState.isLoading) {
      return { ok: false, message: "ログアウト処理中です" };
    }

    try {
      console.log('[Auth] Starting logout');
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

      await mutate(undefined, false);
      return { ok: true };
    } catch (e: any) {
      console.error('[Auth] Logout error:', e);
      const error = { message: "サーバーとの通信に失敗しました" };
      setAuthState({
        isLoading: false,
        error
      });
      return { ok: false, ...error };
    } finally {
      setAuthState({ isLoading: false, error: null });
    }
  }, [authState.isLoading, mutate]);

  const deleteAccount = useCallback(async () => {
    if (authState.isLoading) {
      return { ok: false, message: "処理中です" };
    }

    try {
      console.log('[Auth] Starting account deletion');
      setAuthState({ isLoading: true, error: null });
      
      const response = await fetch("/api/user", {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthState({
          isLoading: false,
          error: { message: data.message || "アカウントの削除に失敗しました" },
        });
        return { ok: false, message: data.message };
      }

      await mutate(undefined, false);
      return { ok: true };
    } catch (e: any) {
      console.error('[Auth] Account deletion error:', e);
      const error = { message: "サーバーとの通信に失敗しました" };
      setAuthState({
        isLoading: false,
        error
      });
      return { ok: false, ...error };
    } finally {
      setAuthState({ isLoading: false, error: null });
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
    deleteAccount,
  };
}