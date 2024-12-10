import React, { StrictMode, Suspense, lazy, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { Toaster } from "./components/ui/toaster";
import { setupErrorHandlers } from "./lib/error-handler";
import "./index.css";

// Initialize error handlers
setupErrorHandlers();

// Lazy load pages
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Documents = lazy(() => import("@/pages/Documents"));
const Athletes = lazy(() => import("@/pages/Athletes"));
const AllTimeRecords = lazy(() => import("@/pages/AllTimeRecords"));
const Competitions = lazy(() => import("@/pages/Competitions"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SWRConfig value={{ 
      fetcher,
      // キャッシュ戦略の最適化
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      // エラーリトライの設定
      errorRetryCount: 3,
      errorRetryInterval: 3000,
      // キャッシュの永続化（オプション）
      provider: (cache) => {
        // 初期状態の復元
        if (typeof window !== 'undefined') {
          const stored = sessionStorage.getItem('app-cache')
          if (stored) {
            cache.set('app-cache', JSON.parse(stored))
          }
        }
        
        return cache
      }
    }}>
      <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-pulse text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <span>読み込み中...</span>
              </div>
            </div>
          </div>
        }>
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
  </StrictMode>
);
