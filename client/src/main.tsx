import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary, withErrorBoundary } from "@/components/ErrorBoundary";
import { LogLevel } from "@/types/auth";

// Global error handlers
window.addEventListener('unhandledrejection', (event) => {
  console.log({
    timestamp: new Date().toISOString(),
    system: 'GlobalError',
    level: LogLevel.ERROR,
    type: 'UnhandledRejection',
    error: {
      message: event.reason?.message || 'Unknown Promise Rejection',
      stack: event.reason?.stack,
    },
    context: {
      critical: true
    }
  });
});

window.addEventListener('error', (event) => {
  console.log({
    timestamp: new Date().toISOString(),
    system: 'GlobalError',
    level: LogLevel.ERROR,
    type: 'UncaughtError',
    error: {
      message: event.error?.message || event.message,
      stack: event.error?.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    },
    context: {
      critical: true
    }
  });
});

// Pages
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Documents from "./pages/Documents";
import Athletes from "./pages/Athletes";
import AllTimeRecords from "./pages/AllTimeRecords";
import Competitions from "./pages/Competitions";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SWRConfig value={{ 
      fetcher,
      onError: (error, key) => {
        console.log({
          timestamp: new Date().toISOString(),
          system: 'SWR',
          level: LogLevel.ERROR,
          type: 'FetchError',
          error: {
            message: error.message,
            stack: error.stack,
          },
          context: {
            key,
            critical: true
          }
        });
      },
      shouldRetryOnError: true,
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true
    }}>
      <ErrorBoundary componentName="RouterRoot">
        <Switch>
          <Route path="/" component={withErrorBoundary(Dashboard, 'Dashboard')} />
          <Route path="/login" component={withErrorBoundary(Login, 'Login')} />
          <Route path="/register" component={withErrorBoundary(Register, 'Register')} />
          <Route path="/documents" component={withErrorBoundary(Documents, 'Documents')} />
          <Route path="/athletes" component={withErrorBoundary(Athletes, 'Athletes')} />
          <Route path="/all-time-records" component={withErrorBoundary(AllTimeRecords, 'AllTimeRecords')} />
          <Route path="/competitions" component={withErrorBoundary(Competitions, 'Competitions')} />
          <Route>404 ページが見つかりません</Route>
        </Switch>
      </ErrorBoundary>
      <Toaster />
    </SWRConfig>
  </StrictMode>,
);
