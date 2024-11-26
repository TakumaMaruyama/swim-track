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
    data, 
    error: swrError, 
    isLoading: swrLoading, 
    mutate 
  } = useSWR<User>("/api/user", {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    shouldRetryOnError: true,
    refreshInterval: 300000, // 5分ごとにセッションを検証
    retry: (_, error) => {
      // ネットワークエラーの場合のみリトライ
      return error?.message?.includes('network') || error?.message?.includes('Failed to fetch');
    },
    retryCount: 3,
    onError: (error) => {
      console.log('[Auth] Session validation failed:', error);
      if (error?.message?.includes('認証') || error?.message?.includes('セッション')) {
        console.log('[Auth] Clearing user data due to session error');
        mutate(undefined, false);
      } else {
        console.error('[Auth] Unexpected error:', error);
      }
    },
    dedupingInterval: 5000, // 5秒間は重複リクエストを防ぐ
    keepPreviousData: true, // 新しいデータの取得中は古いデータを保持
    fetcher: async (url) => {
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '認証エラーが発生しました');
      }
      return response.json();
    },
  });

  const register = useCallback(async (user: InsertUser): Promise<AuthResult> => {
    if (authState.isLoading) {
      console.log('[Auth] Registration already in progress');
      return { ok: false, message: "登録処理中です" };
    }

    try {
      console.log('[Auth] Starting registration attempt');
      setAuthState({ isLoading: true, error: null });

      const response = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        console.log('[Auth] Registration failed:', data.message);
        const error = {
          message: data.message || "登録に失敗しました",
          field: data.field,
          errors: data.errors,
        };
        setAuthState({
          isLoading: false,
          error
        });
        return { ok: false, ...error };
      }

      console.log('[Auth] Registration successful');
      await mutate();
      return { ok: true, user: data.user };
    } catch (e: any) {
      console.error('[Auth] Registration error:', e);
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

  const login = useCallback(async (user: InsertUser): Promise<AuthResult> => {
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

      console.log('[Auth] Login successful');
      await mutate();
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
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.isLoading, mutate]);

  const logout = useCallback(async (): Promise<AuthResult> => {
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
        const error = { message: data.message || "ログアウトに失敗しました" };
        setAuthState({
          isLoading: false,
          error
        });
        return { ok: false, ...error };
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
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.isLoading, mutate]);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    if (authState.isLoading) {
      return { ok: false, message: "削除処理中です" };
    }

    try {
      setAuthState({ isLoading: true, error: null });
      const response = await fetch("/api/user", {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        const error = { message: data.message || "アカウントの削除に失敗しました" };
        setAuthState({
          isLoading: false,
          error
        });
        return { ok: false, ...error };
      }

      await mutate(undefined, false);
      return { ok: true, message: data.message };
    } catch (error) {
      console.error('Error deleting account:', error);
      const errorMessage = { message: "サーバーとの通信に失敗しました" };
      setAuthState({
        isLoading: false,
        error: errorMessage
      });
      return { ok: false, ...errorMessage };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.isLoading, mutate]);

  return {
    user: data,
    isLoading: swrLoading || authState.isLoading,
    isLoginPending: authState.isLoading,
    isAuthenticated: !!data,
    error: authState.error || (swrError ? { message: "認証に失敗しました" } : null),
    register,
    login,
    logout,
    deleteAccount,
  };
}
