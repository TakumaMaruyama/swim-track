import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from "@/hooks/use-toast";
import { Suspense, lazy } from "react";

// Lazy load pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Documents = lazy(() => import("./pages/Documents"));
const Athletes = lazy(() => import("./pages/Athletes"));
const AllTimeRecords = lazy(() => import("./pages/AllTimeRecords"));
const Competitions = lazy(() => import("./pages/Competitions"));

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <ToastProvider>
      <SWRConfig value={{ fetcher }}>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">読み込み中...</div>}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/documents" component={Documents} />
            <Route path="/athletes" component={Athletes} />
            <Route path="/all-time-records" component={AllTimeRecords} />
            <Route path="/competitions" component={Competitions} />
            <Route>404 ページが見つかりません</Route>
          </Switch>
        </Suspense>
        <Toaster />
      </SWRConfig>
    </ToastProvider>
  </StrictMode>
);
