import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { Toaster } from "@/components/ui/toaster";

// Pages
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Documents from "./pages/Documents";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SWRConfig value={{ fetcher }}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/documents" component={Documents} />
        <Route>404 ページが見つかりません</Route>
      </Switch>
      <Toaster />
    </SWRConfig>
  </StrictMode>,
);
