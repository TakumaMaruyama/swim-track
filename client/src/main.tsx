import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { Toaster } from "@/components/ui/toaster";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Lazy load pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Documents = lazy(() => import("./pages/Documents"));
const Athletes = lazy(() => import("./pages/Athletes"));
const AllTimeRecords = lazy(() => import("./pages/AllTimeRecords"));
const Competitions = lazy(() => import("./pages/Competitions"));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// Client-side only AppRouter component
function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Switch>
        <Route path="/">
          <Dashboard />
        </Route>
        <Route path="/login">
          <Login />
        </Route>
        <Route path="/register">
          <Register />
        </Route>
        <Route path="/documents">
          <Documents />
        </Route>
        <Route path="/athletes">
          <Athletes />
        </Route>
        <Route path="/all-time-records">
          <AllTimeRecords />
        </Route>
        <Route path="/competitions">
          <Competitions />
        </Route>
        <Route>
          <div className="flex items-center justify-center min-h-screen">
            404 ページが見つかりません
          </div>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <SWRConfig
        value={{
          fetcher,
          shouldRetryOnError: true,
          errorRetryCount: 3,
          errorRetryInterval: (retryCount) => Math.min(1000 * (2 ** retryCount), 30000),
          revalidateOnFocus: true,
          revalidateOnReconnect: true,
        }}
      >
        <AppRouter />
        <Toaster />
      </SWRConfig>
    </ErrorBoundary>
  );
}

// Ensure React is loaded before mounting
if (typeof window !== 'undefined') {
  const container = document.getElementById("root");
  if (container) {
    const root = createRoot(container);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }
}