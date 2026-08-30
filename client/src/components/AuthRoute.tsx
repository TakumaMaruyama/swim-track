import React from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

const Loading = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

export function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, mustChangePassword } = useAuth();
  const [, navigate] = useLocation();

  React.useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) navigate("/login", { replace: true });
    else if (mustChangePassword) navigate("/change-password", { replace: true });
  }, [isAuthenticated, isLoading, mustChangePassword, navigate]);

  if (isLoading || !isAuthenticated || mustChangePassword) return <Loading />;
  return <>{children}</>;
}

export function PasswordChangeRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, mustChangePassword } = useAuth();
  const [, navigate] = useLocation();

  React.useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) navigate("/login", { replace: true });
    else if (!mustChangePassword) navigate("/", { replace: true });
  }, [isAuthenticated, isLoading, mustChangePassword, navigate]);

  if (isLoading || !isAuthenticated || !mustChangePassword) return <Loading />;
  return <>{children}</>;
}