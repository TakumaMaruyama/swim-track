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
 * Only logs critical events and errors to maintain clean logs.
 * 
 * @param level - Log level (ERROR, WARN, INFO)
 * @param event - Authentication event type (auth.login, auth.register, auth.logout)
 * @param message - Descriptive message about the event
 * @param context - Optional context data (sensitive data automatically filtered)
 */
function logAuthEvent(level: LogLevel, event: string, message: string, context?: Record<string, unknown>): void {
  // Only log errors and critical events
  const shouldLog = 
    level === LogLevel.ERROR || 
    (level === LogLevel.INFO && context?.critical === true);

  if (!shouldLog) return;

  // Filter sensitive information
  const filteredContext = context ? {
    ...context,
    // Remove all sensitive data
    password: undefined,
    credentials: undefined,
    token: undefined,
    sessionId: undefined,
    authData: undefined,
    authState: undefined,
    sessionToken: undefined,
    authToken: undefined
  } : undefined;

  // Use standardized logging format
  console.log({
    timestamp: new Date().toISOString(),
    system: 'Authentication',
    level,
    event: `auth.${event}`,
    message,
    ...(filteredContext && { context: filteredContext })
  });
}

/**
 * Custom hook for managing user authentication state and operations.
 * Provides comprehensive authentication functionality with proper error handling.
 * 
 * Features:
 * - User registration with validation
 * - Secure login with proper state management
 * - Logout with session cleanup
 * - Automatic session refresh
 * - Error boundary integration
 * 
 * @returns {Object} Authentication state and methods
 * @property {User | undefined} user - Current authenticated user or undefined
 * @property {boolean} isLoading - Loading state for auth operations
 * @property {boolean} isAuthChecking - Initial auth state check
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
    shouldRetryOnError: true,
    errorRetryCount: 3,
    refreshInterval: 60000, // 1 minute
    dedupingInterval: 2000,
    onError: (error) => {
      if (error.status === 401) {
        mutate(undefined, false);
        logAuthEvent(LogLevel.INFO, 'session', 'Session expired or invalid', { critical: true });
      }
    }
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
        logAuthEvent(LogLevel.ERROR, 'register.failed', error.message, {
          errors: error.errors,
          critical: true
        });
        return { ok: false, ...error };
      }

      logAuthEvent(LogLevel.INFO, 'register.success', 'User registration completed successfully', {
          critical: true
        });
      await mutate();
      return { ok: true, user: data.user };
    } catch (error) {
      const authError: AuthError = {
        message: "Failed to communicate with server",
        field: "network"
      };
      setAuthState({ isLoading: false, error: authError });
      logAuthEvent(LogLevel.ERROR, 'register.failed', 'Registration failed due to network error', {
        error: error instanceof Error ? error.message : String(error),
        critical: true
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
