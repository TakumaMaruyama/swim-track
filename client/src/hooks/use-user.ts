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

  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRY_ATTEMPTS = 3;
  const RETRY_DELAY = 1000; // 1 second

  const { 
    data: user, 
    error: swrError, 
    isLoading: swrLoading, 
    mutate 
  } = useSWR<User>("/api/user", {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    shouldRetryOnError: false,
    refreshInterval: 30000, // Check every 30 seconds
    onError: async (error) => {
      if (error.message.includes('Not logged in')) {
        console.log('[Auth] Not logged in, skipping refresh');
        mutate(undefined, { revalidate: false });
        return;
      }

      console.log('[Auth] Session validation failed, attempting refresh');
      
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        console.log('[Auth] Max retry attempts reached, clearing user data');
        setRetryCount(0);
        mutate(undefined, { revalidate: false });
        return;
      }

      try {
        const delay = RETRY_DELAY * Math.pow(1.5, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const response = await fetch('/api/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.log('[Auth] Refresh failed:', errorData.message || 'Unknown error');
          
          if (response.status === 401) {
            console.log('[Auth] Session expired or invalid, clearing user data');
            setRetryCount(0);
            mutate(undefined, { revalidate: false });
            return;
          }

          // Only increment retry count for non-401 errors
          setRetryCount(prev => prev + 1);
          throw new Error(errorData.message || 'セッションの更新に失敗しました');
        }

        const refreshedUser = await response.json();
        console.log('[Auth] Session refreshed successfully');
        setRetryCount(0);
        await mutate(refreshedUser, { revalidate: false });
      } catch (e) {
        console.error('[Auth] Refresh error:', e);
        
        // Don't increment retry count for network errors
        if (!(e instanceof TypeError)) {
          setRetryCount(prev => prev + 1);
        }
        
        if (retryCount + 1 >= MAX_RETRY_ATTEMPTS) {
          console.log('[Auth] Max retry attempts reached after error');
          setRetryCount(0);
          mutate(undefined, { revalidate: false });
        }
      }
    }
  });

  const register = useCallback(async (userData: InsertUser): Promise<AuthResult> => {
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
        body: JSON.stringify(userData),
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
        setAuthState({ isLoading: false, error });
        return { ok: false, ...error };
      }

      console.log('[Auth] Registration successful');
      await mutate(data.user, { revalidate: false });
      return { ok: true, user: data.user };
    } catch (e) {
      console.error('[Auth] Registration error:', e);
      const error = {
        message: "サーバーとの通信に失敗しました",
        field: "network",
      };
      setAuthState({ isLoading: false, error });
      return { ok: false, ...error };
    }
  }, [authState.isLoading, mutate]);

  const login = useCallback(async (credentials: InsertUser): Promise<AuthResult> => {
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
        body: JSON.stringify(credentials),
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
        setAuthState({ isLoading: false, error });
        return { ok: false, ...error };
      }

      console.log('[Auth] Login successful');
      await mutate(data.user, { revalidate: false });
      return { ok: true, user: data.user };
    } catch (e) {
      console.error('[Auth] Login error:', e);
      const error = {
        message: "サーバーとの通信に失敗しました",
        field: "network",
      };
      setAuthState({ isLoading: false, error });
      return { ok: false, ...error };
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
        setAuthState({ isLoading: false, error });
        return { ok: false, ...error };
      }

      await mutate(undefined, { revalidate: false });
      return { ok: true };
    } catch (e) {
      console.error('[Auth] Logout error:', e);
      const error = { message: "サーバーとの通信に失敗しました" };
      setAuthState({ isLoading: false, error });
      return { ok: false, ...error };
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
        setAuthState({ isLoading: false, error });
        return { ok: false, ...error };
      }

      await mutate(undefined, { revalidate: false });
      return { ok: true, message: data.message };
    } catch (error) {
      console.error('[Auth] Account deletion error:', error);
      const errorMessage = { message: "サーバーとの通信に失敗しました" };
      setAuthState({ isLoading: false, error: errorMessage });
      return { ok: false, ...errorMessage };
    }
  }, [authState.isLoading, mutate]);

  return {
    user,
    isLoading: swrLoading || authState.isLoading,
    isLoginPending: authState.isLoading,
    isAuthenticated: !!user,
    error: authState.error || (swrError ? { message: "認証に失敗しました" } : null),
    register,
    login,
    logout,
    deleteAccount,
  };
}