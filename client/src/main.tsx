import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route, useLocation } from "wouter";
import "./index.css";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { Toaster } from "@/components/ui/toaster";
import { Suspense, lazy } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useUser } from "./hooks/use-user";
import { Loader2 } from "lucide-react";

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

function ProtectedRoute({ component: Component, ...props }: { component: React.ComponentType<any> }) {
  const { user, isLoading } = useUser();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  return (
    <ErrorBoundary>
      <Component {...props} />
    </ErrorBoundary>
  );
}

function AppRouter() {
  const { user, isLoading } = useUser();
  const [location] = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user && !["/login", "/register"].includes(location)) {
    return (
      <Switch>
        <Route path="/login">
          <Suspense fallback={<LoadingSpinner />}>
            <Login />
          </Suspense>
        </Route>
        <Route path="/register">
          <Suspense fallback={<LoadingSpinner />}>
            <Register />
          </Suspense>
        </Route>
        <Route>
          <Suspense fallback={<LoadingSpinner />}>
            <Login />
          </Suspense>
        </Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/">
        <Suspense fallback={<LoadingSpinner />}>
          <ProtectedRoute component={Dashboard} />
        </Suspense>
      </Route>
      <Route path="/login">
        <Suspense fallback={<LoadingSpinner />}>
          <Login />
        </Suspense>
      </Route>
      <Route path="/register">
        <Suspense fallback={<LoadingSpinner />}>
          <Register />
        </Suspense>
      </Route>
      <Route path="/documents">
        <Suspense fallback={<LoadingSpinner />}>
          <ProtectedRoute component={Documents} />
        </Suspense>
      </Route>
      <Route path="/athletes">
        <Suspense fallback={<LoadingSpinner />}>
          <ProtectedRoute component={Athletes} />
        </Suspense>
      </Route>
      <Route path="/all-time-records">
        <Suspense fallback={<LoadingSpinner />}>
          <ProtectedRoute component={AllTimeRecords} />
        </Suspense>
      </Route>
      <Route path="/competitions">
        <Suspense fallback={<LoadingSpinner />}>
          <ProtectedRoute component={Competitions} />
        </Suspense>
      </Route>
      <Route>
        <div className="flex items-center justify-center min-h-screen">
          404 ページが見つかりません
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <StrictMode>
      <ErrorBoundary>
        <SWRConfig 
          value={{ 
            fetcher,
            shouldRetryOnError: true,
            errorRetryCount: 3,
            errorRetryInterval: (retryCount) => Math.min(1000 * (2 ** retryCount), 30000),
            revalidateOnFocus: true,
            revalidateOnReconnect: true
          }}
        >
          <Suspense fallback={<LoadingSpinner />}>
            <AppRouter />
          </Suspense>
          <Toaster />
        </SWRConfig>
      </ErrorBoundary>
    </StrictMode>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
