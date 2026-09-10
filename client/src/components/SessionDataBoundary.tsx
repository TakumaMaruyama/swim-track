import React, { createContext, useContext } from "react";
import useSWR, { SWRConfig, type SWRResponse } from "swr";
import type { AuthResponse } from "@/hooks/use-auth";

type Session = Pick<SWRResponse<AuthResponse | null>, "data" | "error" | "mutate">;
const SessionContext = createContext<Session | null>(null);

export function useAuthSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useAuth must be used within SessionDataBoundary");
  return session;
}

// Keep the session outside the data cache. Remounting on an identity/permission
// change drops both cached API responses and component-local previous data.
// Requests still in flight can only write into the discarded cache.
export function SessionDataBoundary({ children, fallback = null }: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const session = useSWR<AuthResponse | null>("/api/auth/session", {
    revalidateOnFocus: true,
    keepPreviousData: false,
  });

  if (session.data === undefined && !session.error) return <>{fallback}</>;
  if (session.error && session.error.status !== 401) {
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p>ログイン状態を確認できませんでした。</p>
        <button type="button" onClick={() => void session.mutate()}>再読み込み</button>
      </div>
    );
  }

  // SWR retains the last successful data on errors, including expired sessions.
  const data = session.error ? null : session.data;
  const user = data?.user;
  const identity = user
    ? JSON.stringify([user.id, user.role, user.isActive,
      data?.credentialState ?? user.credentialState,
      Boolean(data?.mustChangePassword || user.mustChangePassword)])
    : "guest";

  return (
    <SessionContext.Provider value={{ data, error: session.error, mutate: session.mutate }}>
      <SWRConfig key={identity} value={{ provider: () => new Map() }}>
        {children}
      </SWRConfig>
    </SessionContext.Provider>
  );
}
