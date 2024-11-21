import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogLevel } from "@/types/auth";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

function logError(error: Error, errorInfo?: React.ErrorInfo) {
  console.log({
    timestamp: new Date().toISOString(),
    system: 'ErrorBoundary',
    level: LogLevel.ERROR,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack
    }
  });
}

export const ErrorBoundaryContext = React.createContext<{
  setError: (error: Error) => void;
}>({
  setError: () => {
    console.warn('ErrorBoundaryContext used outside of provider');
  }
});

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    logError(error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ error: null, errorInfo: null });
  }

  setError = (error: Error) => {
    logError(error);
    this.setState({ error, errorInfo: null });
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Alert variant="destructive" className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-4">
            <p>エラーが発生しました。再度お試しください。</p>
            <p className="text-sm text-muted-foreground">
              {this.state.error.message}
            </p>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <pre className="mt-2 text-xs overflow-auto">
                {this.state.errorInfo.componentStack}
              </pre>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              className="mt-2 w-fit"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              再試行
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <ErrorBoundaryContext.Provider value={{ setError: this.setError }}>
        {this.props.children}
      </ErrorBoundaryContext.Provider>
    );
  }
}

export function useErrorBoundary() {
  return React.useContext(ErrorBoundaryContext);
}
