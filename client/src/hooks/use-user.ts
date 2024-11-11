import useSWR from "swr";
import type { User, InsertUser } from "db/schema";
import { useCallback } from "react";

export function useUser() {
  const { data, error, mutate, isLoading } = useSWR<User>("/api/user", {
    revalidateOnFocus: false,
    shouldRetryOnError: false
  });

  const login = useCallback(async (user: InsertUser) => {
    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        return { ok: false, message: data.message || "ログインに失敗しました" };
      }

      await mutate();
      return { ok: true, user: data.user };
    } catch (e: any) {
      return { ok: false, message: "サーバーとの通信に失敗しました" };
    }
  }, [mutate]);

  const logout = useCallback(async () => {
    try {
      const response = await fetch("/logout", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        return { ok: false, message: data.message || "ログアウトに失敗しました" };
      }

      await mutate(undefined, false);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: "サーバーとの通信に失敗しました" };
    }
  }, [mutate]);

  const register = useCallback(async (user: InsertUser) => {
    try {
      const response = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        return { ok: false, message: data.message || "登録に失敗しました" };
      }

      await mutate();
      return { ok: true, user: data.user };
    } catch (e: any) {
      return { ok: false, message: "サーバーとの通信に失敗しました" };
    }
  }, [mutate]);

  return {
    user: data,
    isLoading,
    isAuthenticated: !!data,
    error,
    login,
    logout,
    register,
  };
}
