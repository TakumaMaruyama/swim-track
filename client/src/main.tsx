import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Suspense, lazy, useEffect, useState } from "react";

// Create a client
const queryClient = new QueryClient();

// Lazy load pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Documents = lazy(() => import("./pages/Documents"));
const Athletes = lazy(() => import("./pages/Athletes"));
const AllTimeRecords = lazy(() => import("./pages/AllTimeRecords"));
const Competitions = lazy(() => import("./pages/Competitions"));
const Login = lazy(() => import("./pages/Login"));

function Router() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // セッションの確認
    fetch("/api/auth/session", {
      credentials: "include"
    })
      .then(response => {
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  }, []);

  // 初期ローディング中
  if (isAuthenticated === null) {
    return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>;
  }

  // 未認証の場合はログインページを表示
  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/documents" component={Documents} />
      <Route path="/athletes" component={Athletes} />
      <Route path="/all-time-records" component={AllTimeRecords} />
      <Route path="/competitions" component={Competitions} />
      <Route>404 ページが見つかりません</Route>
    </Switch>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">読み込み中...</div>}>
        <Router />
      </Suspense>
      <Toaster />
    </QueryClientProvider>
  </StrictMode>
);
