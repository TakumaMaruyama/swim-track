import * as React from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { Toaster } from "./components/ui/toaster";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Suspense, lazy } from "react";

// Lazy load pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Documents = lazy(() => import("./pages/Documents"));
const Athletes = lazy(() => import("./pages/Athletes"));
const AllTimeRecords = lazy(() => import("./pages/AllTimeRecords"));
const Competitions = lazy(() => import("./pages/Competitions"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));

const container = document.getElementById("root");
if (!container) {
  throw new Error("Failed to find root element");
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <SWRConfig value={{ fetcher }}>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">読み込み中...</div>}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/documents" component={Documents} />
            <Route path="/athletes" component={Athletes} />
            <Route path="/all-time-records" component={AllTimeRecords} />
            <Route path="/competitions" component={Competitions} />
            <Route path="/admin/login" component={AdminLogin} />
            <Route>404 ページが見つかりません</Route>
          </Switch>
        </Suspense>
        <Toaster />
      </SWRConfig>
    </ErrorBoundary>
  </React.StrictMode>
);
