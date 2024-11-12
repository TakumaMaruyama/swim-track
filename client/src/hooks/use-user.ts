import useSWR from "swr";
import type { User, InsertUser } from "db/schema";
import { useCallback, useState, useEffect } from "react";

interface AuthError {
  message: string;
  field?: string;
  errors?: Record<string, string[]>;
}

interface AuthState {
  isLoading: boolean;
  error: AuthError | null;
  navigationAttempt: {
    inProgress: boolean;
    timestamp: number;
  };
}

export function useUser() {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: false,
    error: null,
    navigationAttempt: {
      inProgress: false,
      timestamp: 0,
    }
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

  // Cleanup navigation attempts that are stale
  useEffect(() => {
    const NAVIGATION_TIMEOUT = 5000; // 5 seconds
    if (authState.navigationAttempt.inProgress) {
      const timeSinceAttempt = Date.now() - authState.navigationAttempt.timestamp;
      if (timeSinceAttempt > NAVIGATION_TIMEOUT) {
        console.log('[Auth] Cleaning up stale navigation attempt');
        setAuthState(prev => ({
          ...prev,
          navigationAttempt: {
            inProgress: false,
            timestamp: 0
          }
        }));
      }
    }
  }, [authState.navigationAttempt]);

  const login = useCallback(async (user: InsertUser) => {
    if (authState.isLoading) {
      console.log('[Auth] Login already in progress');
      return { ok: false, message: "ログイン処理中です" };
    }

    try {
      console.log('[Auth] Starting login attempt');
      setAuthState(prev => ({ 
        ...prev,
        isLoading: true, 
        error: null,
        navigationAttempt: {
          inProgress: true,
          timestamp: Date.now()
        }
      }));

      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        console.log('[Auth] Login failed:', data.message);
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: {
            message: data.message || "ログインに失敗しました",
            field: data.field,
            errors: data.errors,
          },
          navigationAttempt: {
            inProgress: false,
            timestamp: 0
          }
        }));
        return { ok: false, message: data.message, field: data.field, errors: data.errors };
      }

      console.log('[Auth] Login successful, updating session');
      await mutate();
      setAuthState({
        isLoading: false,
        error: null,
        navigationAttempt: {
          inProgress: false,
          timestamp: 0
        }
      });
      return { ok: true, user: data.user };
    } catch (e: any) {
      console.error('[Auth] Login error:', e);
      const error = {
        message: "サーバーとの通信に失敗しました",
        field: "network",
      };
      setAuthState({
        isLoading: false,
        error,
        navigationAttempt: {
          inProgress: false,
          timestamp: 0
        }
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
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      const response = await fetch("/logout", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: { message: data.message || "ログアウトに失敗しました" },
        }));
        return { ok: false, message: data.message };
      }

      // Clear user data and reset state
      await mutate(undefined, false);
      setAuthState({
        isLoading: false,
        error: null,
        navigationAttempt: {
          inProgress: false,
          timestamp: 0
        }
      });
      return { ok: true };
    } catch (e: any) {
      console.error('[Auth] Logout error:', e);
      const error = { message: "サーバーとの通信に失敗しました" };
      setAuthState({
        isLoading: false,
        error,
        navigationAttempt: {
          inProgress: false,
          timestamp: 0
        }
      });
      return { ok: false, ...error };
    }
  }, [authState.isLoading, mutate]);

  return {
    user: data,
    isLoading: swrLoading || authState.isLoading,
    isLoginPending: authState.isLoading,
    isAuthenticated: !!data,
    isNavigating: authState.navigationAttempt.inProgress,
    error: authState.error || (swrError ? { message: "認証に失敗しました" } : null),
    login,
    logout,
  };
}
