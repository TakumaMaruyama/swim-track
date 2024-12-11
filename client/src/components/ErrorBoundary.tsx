
import React, { Component, ErrorInfo } from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
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

  private cleanupTimeout?: number;
  private mounted: boolean = false;

  public componentDidMount() {
    this.mounted = true;
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    if (this.cleanupTimeout) {
      window.clearTimeout(this.cleanupTimeout);
    }
    
    this.cleanupTimeout = window.setTimeout(() => {
      if (this.mounted) {
        this.setState({ hasError: false });
      }
    }, 5000) as unknown as number;

    this.setState({ hasError: true });
  }

  public componentWillUnmount() {
    this.mounted = false;
    if (this.cleanupTimeout) {
      window.clearTimeout(this.cleanupTimeout);
    }
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Alert variant="destructive" className="mx-auto max-w-md my-8 p-4 animate-slide-up flex items-center gap-3 rounded-xl shadow-lg">
          <AlertCircle className="h-6 w-6 flex-shrink-0" />
          <AlertDescription className="text-sm leading-relaxed">
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
