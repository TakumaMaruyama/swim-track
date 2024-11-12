import useSWR from "swr";
import type { User, InsertUser } from "db/schema";
import { useCallback, useState, useEffect, useRef } from "react";

interface AuthError {
  message: string;
  field?: string;
  errors?: Record<string, string[]>;
}

interface NavigationAttempt {
  inProgress: boolean;
  timestamp: number;
  retryCount: number;
  success?: boolean;
}

interface AuthState {
  isLoading: boolean;
  error: AuthError | null;
  navigationAttempt: NavigationAttempt;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const NAVIGATION_TIMEOUT = 5000;

export function useUser() {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: false,
    error: null,
    navigationAttempt: {
      inProgress: false,
      timestamp: 0,
      retryCount: 0,
      success: undefined
    }
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const navigationTimeoutRef = useRef<NodeJS.Timeout>();

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

  const clearTimeouts = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
  }, []);

  const resetNavigationState = useCallback(() => {
    console.log('[Auth] Resetting navigation state');
    clearTimeouts();
    setAuthState(prev => ({
      ...prev,
      navigationAttempt: {
        inProgress: false,
        timestamp: 0,
        retryCount: 0,
        success: undefined
      }
    }));
  }, [clearTimeouts]);

  // Handle navigation timeouts and cleanup
  useEffect(() => {
    if (authState.navigationAttempt.inProgress) {
      console.log('[Auth] Setting up navigation timeout');
      navigationTimeoutRef.current = setTimeout(() => {
        console.log('[Auth] Navigation timeout reached');
        resetNavigationState();
      }, NAVIGATION_TIMEOUT);

      return () => {
        clearTimeouts();
      };
    }
  }, [authState.navigationAttempt.inProgress, resetNavigationState, clearTimeouts]);

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
          retryCount: 0,
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

      console.log('[Auth] Login successful, updating session');
      await mutate();
      
      // Implement retry mechanism for session validation
      const validateSession = async (retryCount: number = 0) => {
        const sessionResponse = await fetch("/api/user", { credentials: "include" });
        if (!sessionResponse.ok && retryCount < MAX_RETRIES) {
          console.log(`[Auth] Session validation retry ${retryCount + 1}/${MAX_RETRIES}`);
          retryTimeoutRef.current = setTimeout(() => {
            validateSession(retryCount + 1);
          }, RETRY_DELAY);
          return;
        }

        if (sessionResponse.ok) {
          console.log('[Auth] Session validated successfully');
          setAuthState(prev => ({
            ...prev,
            isLoading: false,
            error: null,
            navigationAttempt: {
              ...prev.navigationAttempt,
              success: true
            }
          }));
        } else {
          console.log('[Auth] Session validation failed after retries');
          resetNavigationState();
        }
      };

      await validateSession();
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeouts();
    };
  }, [clearTimeouts]);

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
