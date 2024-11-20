// External libraries
import useSWR from "swr";
import { useCallback, useState } from "react";

// Types
import type { User, InsertUser } from "db/schema";
import { 
  AuthError, 
  AuthState, 
  AuthResult,
  LogLevel 
} from "../types/auth";

/**
 * Structured logging function with filtered output
 * Only logs critical errors and important state changes
 */
function logAuth(level: LogLevel, operation: string, message: string, context?: Record<string, unknown>): void {
  const shouldLog = 
    level === LogLevel.ERROR || 
    (context?.critical === true);

  if (shouldLog) {
    console.log('[Auth]', {
      timestamp: new Date().toISOString(),
      level,
      operation,
      message,
      ...(context && { context })
    });
  }
}

/**
 * Custom hook for managing user authentication state and operations
 * Provides login, register, and logout functionality with proper error handling
 * 
 * @returns {Object} Authentication state and methods
 * @property {User | undefined} user - Current user data
 * @property {boolean} isLoading - Loading state for auth operations
 * @property {boolean} isAuthChecking - Initial auth state check
 * @property {boolean} isAuthenticated - User authentication status
 * @property {AuthError | null} error - Current auth error state
 * @property {Function} register - User registration method
 * @property {Function} login - User login method
 * @property {Function} logout - User logout method
 */
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
    refreshInterval: 300000, // 5 minutes
    onError: () => mutate(undefined, false)
  });

  /**
   * Handles user registration
   * @param user - User registration data
   * @returns Promise<AuthResult> - Result of the registration attempt
   */
  const register = useCallback(async (user: InsertUser): Promise<AuthResult> => {
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
        const error: AuthError = {
          message: data.message || "登録に失敗しました",
          field: data.field,
          errors: data.errors
        };
        setAuthState({ isLoading: false, error });
        logAuth(LogLevel.ERROR, 'register', error.message, {
          username: user.username,
          errors: error.errors
        });
        return { ok: false, ...error };
      }

      logAuth(LogLevel.INFO, 'register', '登録が完了しました', {
        username: user.username,
        critical: true
      });
      await mutate();
      return { ok: true, user: data.user };
    } catch (error) {
      const authError: AuthError = {
        message: "サーバーとの通信に失敗しました",
        field: "network"
      };
      setAuthState({ isLoading: false, error: authError });
      logAuth(LogLevel.ERROR, 'register', authError.message, {
        username: user.username,
        error: error instanceof Error ? error.message : String(error)
      });
      return { ok: false, ...authError };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.isLoading, mutate]);

  /**
   * Handles user login
   * @param user - User login credentials
   * @returns Promise<AuthResult> - Result of the login attempt
   */
  const login = useCallback(async (user: InsertUser): Promise<AuthResult> => {
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
        const error: AuthError = {
          message: data.message || "ログインに失敗しました",
          field: data.field,
          errors: data.errors
        };
        setAuthState({ isLoading: false, error });
        logAuth(LogLevel.WARN, 'login', error.message, {
          username: user.username,
          critical: true
        });
        return { ok: false, ...error };
      }

      logAuth(LogLevel.INFO, 'login', 'ログインに成功しました', {
        username: user.username,
        critical: true
      });
      await mutate();
      return { ok: true, user: data.user };
    } catch (error) {
      const authError: AuthError = {
        message: "サーバーとの通信に失敗しました",
        field: "network"
      };
      setAuthState({ isLoading: false, error: authError });
      logAuth(LogLevel.ERROR, 'login', authError.message, {
        username: user.username,
        error: error instanceof Error ? error.message : String(error)
      });
      return { ok: false, ...authError };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.isLoading, mutate]);

  /**
   * Handles user logout
   * @returns Promise<AuthResult> - Result of the logout attempt
   */
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

      const data = await response.json();

      if (!response.ok) {
        const error: AuthError = {
          message: data.message || "ログアウトに失敗しました",
          field: "network"
        };
        setAuthState({ isLoading: false, error });
        logAuth(LogLevel.ERROR, 'logout', error.message);
        return { ok: false, ...error };
      }

      logAuth(LogLevel.INFO, 'logout', 'ログアウトが完了しました', {
        critical: true
      });
      await mutate(undefined, false);
      return { ok: true };
    } catch (error) {
      const authError: AuthError = {
        message: "サーバーとの通信に失敗しました",
        field: "network"
      };
      setAuthState({ isLoading: false, error: authError });
      logAuth(LogLevel.ERROR, 'logout', authError.message, {
        error: error instanceof Error ? error.message : String(error)
      });
      return { ok: false, ...authError };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.isLoading, mutate]);

  return {
    user: data,
    isLoading: swrLoading || authState.isLoading,
    isAuthChecking: swrLoading,
    isAuthenticated: !!data,
    error: authState.error || (swrError ? { 
      message: "認証に失敗しました"
    } : null),
    register,
    login,
    logout,
  };
}
