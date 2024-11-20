import useSWR from "swr";
import { useCallback, useState } from "react";
import type { User, InsertUser } from "db/schema";

/** Authentication error interface */
interface AuthError {
  message: string;
  field?: "credentials" | "network" | "username" | "password";
  errors?: Record<string, string[]>;
}

/** Authentication state interface */
interface AuthState {
  isLoading: boolean;
  error: AuthError | null;
}

/** Authentication result interface */
interface AuthResult {
  ok: boolean;
  message?: string;
  field?: AuthError['field'];
  errors?: Record<string, string[]>;
  user?: User;
}

/**
 * Custom hook for managing user authentication state and operations
 * Provides login, register, and logout functionality with proper error handling
 * 
 * @returns {Object} Authentication state and operations
 * @property {User | undefined} user - Current authenticated user
 * @property {boolean} isLoading - Loading state for authentication operations
 * @property {boolean} isAuthChecking - Initial auth state check loading
 * @property {boolean} isAuthenticated - Whether user is authenticated
 * @property {AuthError | null} error - Current authentication error
 * @property {Function} register - User registration function
 * @property {Function} login - User login function
 * @property {Function} logout - User logout function
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
   * Handles user registration with proper error handling and state management
   * @param {InsertUser} user - User registration data
   * @returns {Promise<AuthResult>} Result of registration attempt
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
          errors: data.errors,
        };
        setAuthState({ isLoading: false, error });
        return { ok: false, ...error };
      }

      await mutate();
      return { ok: true, user: data.user };
    } catch (error) {
      const authError: AuthError = {
        message: "サーバーとの通信に失敗しました",
        field: "network",
      };
      setAuthState({ isLoading: false, error: authError });
      return { ok: false, ...authError };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.isLoading, mutate]);

  /**
   * Handles user login with proper error handling and state management
   * @param {InsertUser} user - User login credentials
   * @returns {Promise<AuthResult>} Result of login attempt
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
          errors: data.errors,
        };
        setAuthState({ isLoading: false, error });
        return { ok: false, ...error };
      }

      await mutate();
      return { ok: true, user: data.user };
    } catch (error) {
      const authError: AuthError = {
        message: "サーバーとの通信に失敗しました",
        field: "network",
      };
      setAuthState({ isLoading: false, error: authError });
      return { ok: false, ...authError };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.isLoading, mutate]);

  /**
   * Handles user logout with proper error handling and state management
   * @returns {Promise<AuthResult>} Result of logout attempt
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
        return { ok: false, ...error };
      }

      await mutate(undefined, false);
      return { ok: true };
    } catch (error) {
      const authError: AuthError = { 
        message: "サーバーとの通信に失敗しました",
        field: "network"
      };
      setAuthState({ isLoading: false, error: authError });
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
    error: authState.error || (swrError ? { message: "認証に失敗しました" } : null),
    register,
    login,
    logout,
  };
}
