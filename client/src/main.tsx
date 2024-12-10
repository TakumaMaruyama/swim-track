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

// Lazy load pages with preload hints
const Dashboard = lazy(() => {
  const promise = import("@/pages/Dashboard");
  promise.then(() => { /* トレースのための空の処理 */ });
  return promise;
});
const Documents = lazy(() => {
  const promise = import("@/pages/Documents");
  promise.then(() => { /* トレースのための空の処理 */ });
  return promise;
});
const Athletes = lazy(() => {
  const promise = import("@/pages/Athletes");
  promise.then(() => { /* トレースのための空の処理 */ });
  return promise;
});
const AllTimeRecords = lazy(() => {
  const promise = import("@/pages/AllTimeRecords");
  promise.then(() => { /* トレースのための空の処理 */ });
  return promise;
});
const Competitions = lazy(() => {
  const promise = import("@/pages/Competitions");
  promise.then(() => { /* トレースのための空の処理 */ });
  return promise;
});
const AdminLogin = lazy(() => {
  const promise = import("@/pages/AdminLogin");
  promise.then(() => { /* トレースのための空の処理 */ });
  return promise;
});

// プリロードのためのユーティリティ関数
const preloadRoute = (route: string) => {
  switch (route) {
    case '/':
      Dashboard.preload?.();
      break;
    case '/documents':
      Documents.preload?.();
      break;
    case '/athletes':
      Athletes.preload?.();
      break;
    case '/all-time-records':
      AllTimeRecords.preload?.();
      break;
    case '/competitions':
      Competitions.preload?.();
      break;
    case '/admin/login':
      AdminLogin.preload?.();
      break;
  }
};

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
      // キャッシュの永続化とメモリ最適化
      provider: (cache) => {
        // 初期状態の復元
        if (typeof window !== 'undefined') {
          const stored = sessionStorage.getItem('app-cache')
          if (stored) {
            try {
              const parsedCache = JSON.parse(stored)
              Object.entries(parsedCache).forEach(([key, value]) => {
                cache.set(key, value)
              })
            } catch (error) {
              console.error('キャッシュの復元に失敗しました:', error)
              sessionStorage.removeItem('app-cache')
            }
          }
        }

        // キャッシュの自動クリーンアップ
        const cleanup = setInterval(() => {
          const keys = Array.from(cache.keys())
          const now = Date.now()
          keys.forEach(key => {
            const value = cache.get(key)
            if (value && value.timestamp && now - value.timestamp > 1800000) { // 30分
              cache.delete(key)
            }
          })
        }, 300000) // 5分ごとにクリーンアップ

        // アンマウント時にクリーンアップ
        window.addEventListener('beforeunload', () => {
          clearInterval(cleanup)
          const cacheData = Object.fromEntries(cache.entries())
          sessionStorage.setItem('app-cache', JSON.stringify(cacheData))
        })
        
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
