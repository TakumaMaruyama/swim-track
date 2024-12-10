import React, { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { Toaster } from "./components/ui/toaster";
import { setupErrorHandlers } from "./lib/error-handler";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

// Initialize error handlers
setupErrorHandlers();

// Lazy load pages with preload hints
const Dashboard = lazy(() => {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = '/src/pages/Dashboard';
    document.head.appendChild(link);
  }
  return import("@/pages/Dashboard");
});

const Documents = lazy(() => {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = '/src/pages/Documents';
    document.head.appendChild(link);
  }
  return import("@/pages/Documents");
});

const Athletes = lazy(() => {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = '/src/pages/Athletes';
    document.head.appendChild(link);
  }
  return import("@/pages/Athletes");
});

const AllTimeRecords = lazy(() => {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = '/src/pages/AllTimeRecords';
    document.head.appendChild(link);
  }
  return import("@/pages/AllTimeRecords");
});

const Competitions = lazy(() => {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = '/src/pages/Competitions';
    document.head.appendChild(link);
  }
  return import("@/pages/Competitions");
});

const AdminLogin = lazy(() => {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = '/src/pages/AdminLogin';
    document.head.appendChild(link);
  }
  return import("@/pages/AdminLogin");
});

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
          <Route path="/documents">
            <Suspense fallback={<LoadingSpinner />}>
              <ErrorBoundary>
                <Documents />
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
                <AllTimeRecords />
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
          <Route>404 ページが見つかりません</Route>
        </Switch>
        <Toaster />
      </SWRConfig>
    </ErrorBoundary>
  </StrictMode>
);