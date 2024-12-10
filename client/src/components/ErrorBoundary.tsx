import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Alert variant="destructive" className="m-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="text-sm">
            申し訳ありません。データの取得中にエラーが発生しました。
            <br />
            しばらく待ってから再度お試しください。
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}
