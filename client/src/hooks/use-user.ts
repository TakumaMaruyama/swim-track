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
 * Structured logging function for client-side authentication.
 * Logs only critical authentication events and errors.
 * 
 * @param level - Log level from LogLevel enum
 * @param operation - Auth operation (login, register, logout)
 * @param message - Event description
 * @param context - Optional context (sensitive data filtered)
 */
function logAuth(level: LogLevel, operation: string, message: string, context?: Record<string, unknown>): void {
  // Only log critical auth events and errors
  const shouldLog = 
    level === LogLevel.ERROR || 
    (level === LogLevel.INFO && context?.critical === true);

  if (!shouldLog) return;

  // Filter sensitive data
  const filteredContext = context ? {
    ...context,
    password: undefined,
    credentials: undefined,
    token: undefined,
    sessionId: undefined,
    authToken: undefined,
    sessionData: undefined,
    authState: undefined
  } : undefined;

  // Use consistent log format
  console.log({
    timestamp: new Date().toISOString(),
    system: 'ClientAuth',
    level,
    operation,
    message,
    ...(filteredContext && { context: filteredContext }
  });
}

/**
 * Custom hook for managing user authentication state and operations
 * Provides login, register, and logout functionality with proper error handling
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
   */
  const register = useCallback(async (user: InsertUser): Promise<AuthResult> => {
    if (authState.isLoading) {
      return { ok: false, message: "Registration in progress" };
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
          message: data.message || "Registration failed",
          field: data.field,
          errors: data.errors
        };
        setAuthState({ isLoading: false, error });
        logAuth(LogLevel.ERROR, 'register_error', error.message, {
          errors: error.errors
        });
        return { ok: false, ...error };
      }

      logAuth(LogLevel.INFO, 'register_success', 'Registration successful');
      await mutate();
      return { ok: true, user: data.user };
    } catch (error) {
      const authError: AuthError = {
        message: "Failed to communicate with server",
        field: "network"
      };
      setAuthState({ isLoading: false, error: authError });
      logAuth(LogLevel.ERROR, 'register_error', authError.message, {
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
   */
  const login = useCallback(async (user: InsertUser): Promise<AuthResult> => {
    if (authState.isLoading) {
      return { ok: false, message: "Login in progress" };
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
          message: data.message || "Login failed",
          field: data.field,
          errors: data.errors
        };
        setAuthState({ isLoading: false, error });
        logAuth(LogLevel.ERROR, 'login_error', error.message);
        return { ok: false, ...error };
      }

      logAuth(LogLevel.INFO, 'login_success', 'Login successful');
      await mutate();
      return { ok: true, user: data.user };
    } catch (error) {
      const authError: AuthError = {
        message: "Failed to communicate with server",
        field: "network"
      };
      setAuthState({ isLoading: false, error: authError });
      logAuth(LogLevel.ERROR, 'login_error', authError.message, {
        error: error instanceof Error ? error.message : String(error)
      });
      return { ok: false, ...authError };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.isLoading, mutate]);

  /**
   * Handles user logout
   */
  const logout = useCallback(async (): Promise<AuthResult> => {
    if (authState.isLoading) {
      return { ok: false, message: "Logout in progress" };
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
          message: data.message || "Logout failed",
          field: "network"
        };
        setAuthState({ isLoading: false, error });
        logAuth(LogLevel.ERROR, 'logout_error', error.message);
        return { ok: false, ...error };
      }

      logAuth(LogLevel.INFO, 'logout_success', 'Logout successful');
      await mutate(undefined, false);
      return { ok: true };
    } catch (error) {
      const authError: AuthError = {
        message: "Failed to communicate with server",
        field: "network"
      };
      setAuthState({ isLoading: false, error: authError });
      logAuth(LogLevel.ERROR, 'logout_error', authError.message, {
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
      message: "Authentication failed"
    } : null),
    register,
    login,
    logout,
  };
}
