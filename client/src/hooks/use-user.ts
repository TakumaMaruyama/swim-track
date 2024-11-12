import useSWR from "swr";
import type { User, InsertUser } from "db/schema";
import { useCallback, useState, useEffect } from "react";

interface AuthError {
  message: string;
  field?: string;
  errors?: Record<string, string[]>;
}

interface NavigationAttempt {
  inProgress: boolean;
  timestamp: number;
  success?: boolean;
}

interface AuthState {
  isLoading: boolean;
  error: AuthError | null;
  navigationAttempt: NavigationAttempt;
}

export function useUser() {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: false,
    error: null,
    navigationAttempt: {
      inProgress: false,
      timestamp: 0,
      success: undefined
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
    refreshInterval: 300000,
    onError: () => {
      console.log('[Auth] Session validation failed, clearing user data');
      mutate(undefined, false);
    }
  });

  const resetNavigationState = useCallback(() => {
    console.log('[Auth] Resetting navigation state');
    setAuthState(prev => ({
      ...prev,
      navigationAttempt: {
        inProgress: false,
        timestamp: 0,
        success: undefined
      }
    }));
  }, []);

  // Monitor authentication state changes
  useEffect(() => {
    if (data) {
      console.log('[Auth] User data received, updating navigation state');
      setAuthState(prev => ({
        ...prev,
        navigationAttempt: {
          ...prev.navigationAttempt,
          success: true
        }
      }));
    }
  }, [data]);

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
          timestamp: Date.now(),
          success: undefined
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
        resetNavigationState();
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: {
            message: data.message || "ログインに失敗しました",
            field: data.field,
            errors: data.errors,
          }
        }));
        return { ok: false, message: data.message, field: data.field, errors: data.errors };
      }

      console.log('[Auth] Login successful, forcing state update');
      await mutate();
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        navigationAttempt: {
          inProgress: true,
          timestamp: Date.now(),
          success: true
        }
      }));
      return { ok: true, user: data.user };
    } catch (e: any) {
      console.error('[Auth] Login error:', e);
      const error = {
        message: "サーバーとの通信に失敗しました",
        field: "network",
      };
      resetNavigationState();
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error
      }));
      return { ok: false, ...error };
    }
  }, [authState.isLoading, mutate, resetNavigationState]);

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

      await mutate(undefined, false);
      resetNavigationState();
      return { ok: true };
    } catch (e: any) {
      console.error('[Auth] Logout error:', e);
      const error = { message: "サーバーとの通信に失敗しました" };
      resetNavigationState();
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error
      }));
      return { ok: false, ...error };
    }
  }, [authState.isLoading, mutate, resetNavigationState]);

  return {
    user: data,
    isLoading: swrLoading || authState.isLoading,
    isLoginPending: authState.isLoading,
    isAuthenticated: !!data,
    isNavigating: authState.navigationAttempt.inProgress,
    navigationSuccess: authState.navigationAttempt.success,
    error: authState.error || (swrError ? { message: "認証に失敗しました" } : null),
    login,
    logout,
  };
}