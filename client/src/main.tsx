import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { Toaster } from "./components/ui/toaster";
import { setupErrorHandlers } from "./lib/error-handler";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { preloadComponents } from "./lib/preload";
import "./index.css";

// Initialize error handlers and preload components
setupErrorHandlers();
preloadComponents();

// Lazy load pages with retry configuration
const retryImport = async (importFn: () => Promise<any>, retries = 3) => {
  try {
    return await importFn();
  } catch (err) {
    if (retries > 0) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(retryImport(importFn, retries - 1));
        }, 1000);
      });
    }
    throw err;
  }
};

// Lazy load pages
const Dashboard = lazy(() => retryImport(() => import("./pages/Dashboard")));
const Athletes = lazy(() => retryImport(() => import("./pages/Athletes")));
const RecordsAll = lazy(() => retryImport(() => import("./pages/RecordsAll")));
const Competitions = lazy(() => retryImport(() => import("./pages/Competitions")));
const AdminLogin = lazy(() => retryImport(() => import("./pages/AdminLogin")));
const IMRankings = lazy(() => retryImport(() => import("./pages/IMRankings")));

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

const root = createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <ErrorBoundary>
      <SWRConfig
        value={{
          fetcher,
          revalidateOnFocus: false,
          revalidateOnReconnect: true,
          dedupingInterval: 5000,
          errorRetryCount: 3,
          errorRetryInterval: 3000,
          keepPreviousData: true,
          suspense: false,
          provider: () => new Map(),
          onErrorRetry: (error: any, _key: string, _config: any, revalidate: (options?: any) => Promise<any>, { retryCount }: { retryCount: number }) => {
            // Never retry on 404
            if (error.status === 404) return;

            // Only retry up to 3 times
            if (retryCount >= 3) return;

            // Retry after 3 seconds
            setTimeout(() => revalidate({ retryCount }), 3000);
          },
        }}
      >
        <Switch>
          <Route path="/">
            <Suspense fallback={<LoadingSpinner />}>
              <ErrorBoundary>
                <Dashboard />
              </ErrorBoundary>
            </Suspense>
          </Route>
          <Route path="/athletes">
            <Suspense fallback={<LoadingSpinner />}>
              <ErrorBoundary>
                <Athletes />
              </ErrorBoundary>
            </Suspense>
          </Route>
          <Route path="/all-time-records">
            <Suspense fallback={<LoadingSpinner />}>
              <ErrorBoundary>
                <RecordsAll />
              </ErrorBoundary>
            </Suspense>
          </Route>
          <Route path="/records">
            <Suspense fallback={<LoadingSpinner />}>
              <ErrorBoundary>
                <RecordsAll />
              </ErrorBoundary>
            </Suspense>
          </Route>
          <Route path="/competitions">
            <Suspense fallback={<LoadingSpinner />}>
              <ErrorBoundary>
                <Competitions />
              </ErrorBoundary>
            </Suspense>
          </Route>
          <Route path="/admin/login">
            <Suspense fallback={<LoadingSpinner />}>
              <ErrorBoundary>
                <AdminLogin />
              </ErrorBoundary>
            </Suspense>
          </Route>
          <Route path="/im-rankings">
            <Suspense fallback={<LoadingSpinner />}>
              <ErrorBoundary>
                <IMRankings />
              </ErrorBoundary>
            </Suspense>
          </Route>
          <Route>404 ページが見つかりません</Route>
        </Switch>
        <Toaster />
      </SWRConfig>
    </ErrorBoundary>
  </StrictMode>
);