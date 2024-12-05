import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Suspense, lazy } from "react";
import { useAuth } from "./hooks/use-auth";

// Create a client
const queryClient = new QueryClient();

// Lazy load pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Documents = lazy(() => import("./pages/Documents"));
const Athletes = lazy(() => import("./pages/Athletes"));
const AllTimeRecords = lazy(() => import("./pages/AllTimeRecords"));
const Competitions = lazy(() => import("./pages/Competitions"));
const UserLogin = lazy(() => import("./pages/UserLogin"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // 初期ローディング中は何も表示しない
  }

  if (!user) {
    return <UserLogin />;
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/documents" component={Documents} />
      <Route path="/athletes" component={Athletes} />
      <Route path="/all-time-records" component={AllTimeRecords} />
      <Route path="/competitions" component={Competitions} />
      <Route path="/admin/login" component={AdminLogin} />
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
