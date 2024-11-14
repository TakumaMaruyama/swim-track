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
  retryCount: number;
}

interface AuthResult {
  ok: boolean;
  message?: string;
  field?: string;
  errors?: Record<string, string[]>;
  user?: User;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export function useUser() {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: false,
    error: null,
    retryCount: 0
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
    onError: (error) => {
      console.error('[Auth] Session validation failed:', error);
      mutate(undefined, false);
    }
  });

  const handleAuthRequest = async (
    requestFn: () => Promise<Response>,
    actionType: string
  ): Promise<AuthResult> => {
    let retryCount = 0;
    
    while (retryCount < MAX_RETRIES) {
      try {
        console.log(`[Auth] Attempting ${actionType} (attempt ${retryCount + 1})`);
        const response = await requestFn();
        const data = await response.json();

        if (!response.ok) {
          console.error(`[Auth] ${actionType} failed:`, data);
          throw { response, data };
        }

        console.log(`[Auth] ${actionType} successful`);
        return { ok: true, ...data };
      } catch (error: any) {
        console.error(`[Auth] ${actionType} error:`, error);
        retryCount++;

        if (retryCount < MAX_RETRIES && (!error.response || error.response.status >= 500)) {
          console.log(`[Auth] Retrying ${actionType} in ${RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          continue;
        }

        const errorData = error.data || { message: "サーバーとの通信に失敗しました" };
        return { 
          ok: false, 
          message: errorData.message,
          field: errorData.field,
          errors: errorData.errors
        };
      }
    }

    return { 
      ok: false, 
      message: `${MAX_RETRIES}回の試行後も${actionType}に失敗しました` 
    };
  };

  const login = useCallback(async (user: InsertUser): Promise<AuthResult> => {
    if (authState.isLoading) {
      console.log('[Auth] Login already in progress');
      return { ok: false, message: "ログイン処理中です" };
    }

    setAuthState({ ...authState, isLoading: true, error: null });

    try {
      const result = await handleAuthRequest(
        () => fetch("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
          credentials: "include",
        }),
        "login"
      );

      if (result.ok && result.user) {
        await mutate(result.user, false);
      }

      return result;
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.isLoading, mutate]);

  const register = useCallback(async (user: InsertUser): Promise<AuthResult> => {
    if (authState.isLoading) {
      console.log('[Auth] Registration already in progress');
      return { ok: false, message: "登録処理中です" };
    }

    setAuthState({ ...authState, isLoading: true, error: null });

    try {
      const result = await handleAuthRequest(
        () => fetch("/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
          credentials: "include",
        }),
        "registration"
      );

      if (result.ok) {
        await mutate();
      }

      return result;
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.isLoading, mutate]);

  const logout = useCallback(async (): Promise<AuthResult> => {
    if (authState.isLoading) {
      return { ok: false, message: "ログアウト処理中です" };
    }

    setAuthState({ ...authState, isLoading: true, error: null });

    try {
      const result = await handleAuthRequest(
        () => fetch("/logout", {
          method: "POST",
          credentials: "include",
        }),
        "logout"
      );

      if (result.ok) {
        await mutate(undefined, false);
      }

      return result;
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.isLoading, mutate]);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    if (authState.isLoading) {
      return { ok: false, message: "削除処理中です" };
    }

    setAuthState({ ...authState, isLoading: true, error: null });

    try {
      const result = await handleAuthRequest(
        () => fetch("/api/user", {
          method: "DELETE",
          credentials: "include",
        }),
        "account deletion"
      );

      if (result.ok) {
        await mutate(undefined, false);
      }

      return result;
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
