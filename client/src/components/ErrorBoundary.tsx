import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogLevel } from "@/types/auth";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  componentName?: string;
}

interface State {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorCount: number;
  lastError: number | null;
}

interface ErrorContext {
  browserInfo: {
    userAgent: string;
    language: string;
    platform: string;
    screenSize: string;
    timeZone: string;
    networkStatus: string;
  };
  timestamp: string;
  componentStack?: string | null;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  url: string;
  sessionStatus?: string;
  retryCount?: number;
}

function getErrorContext(error: Error, errorInfo?: React.ErrorInfo): ErrorContext {
  return {
    browserInfo: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      networkStatus: navigator.onLine ? 'online' : 'offline'
    },
    timestamp: new Date().toISOString(),
    componentStack: errorInfo?.componentStack,
    errorType: error.name,
    errorMessage: error.message,
    stackTrace: error.stack,
    url: window.location.href,
    networkStatus: navigator.onLine ? 'online' : 'offline'
  };
}

function logError(error: Error, errorInfo?: React.ErrorInfo, componentName?: string) {
  const context = getErrorContext(error, errorInfo);
  
  console.log({
    timestamp: context.timestamp,
    system: 'ErrorBoundary',
    level: LogLevel.ERROR,
    component: componentName || 'Unknown',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
      componentStack: context.componentStack
    },
    context: {
      browser: context.browserInfo,
      recoverable: error instanceof Error && 'recoverable' in error ? error.recoverable : true,
    }
  });
}

/** Enhanced error recovery strategies with improved logging and recovery mechanisms */
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const ErrorRecoveryStrategies = {
  // Delay helper for retries
  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Enhanced retry mechanism
  async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = MAX_RETRIES,
    initialDelay: number = RETRY_DELAY
  ): Promise<T> {
    let lastError: Error;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        await this.delay(initialDelay * Math.pow(2, attempt)); // Exponential backoff
      }
    }
    throw lastError!;
  },
  // Handle authentication and session errors
  async handleAuthError(error: Error): Promise<boolean> {
    if (error.message.toLowerCase().includes('auth') || 
        error.message.toLowerCase().includes('session') ||
        error.message.toLowerCase().includes('token')) {
      // Clear auth state and redirect to login
      try {
        localStorage.removeItem('auth');
        sessionStorage.removeItem('auth');
        window.location.href = '/login';
        return true;
      } catch {
        return false;
      }
    }
    return false;
  },

  // Handle API and data fetching errors
  async handleAPIError(error: Error): Promise<boolean> {
    if (error.message.toLowerCase().includes('api') || 
        error.message.toLowerCase().includes('fetch') ||
        error.message.includes('SWR')) {
      // Clear SWR cache and retry
      try {
        const cache = 'mutate' in window ? (window as any).mutate : null;
        if (cache) {
          await cache();
          return true;
        }
      } catch {
        return false;
      }
    }
    return false;
  },
  // Attempt to recover from network errors
  async handleNetworkError(error: Error): Promise<boolean> {
    if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('failed to fetch')) {
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 2000));
      return true;
    }
    return false;
  },

  // Handle state-related errors
  handleStateError(error: Error): boolean {
    if (error.message.includes('state') || error.message.includes('props')) {
      // Clear local storage and session storage
      try {
        localStorage.clear();
        sessionStorage.clear();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  },

  // Generic error recovery
  async attemptRecovery(error: Error): Promise<boolean> {
    try {
      const strategies = [
        ErrorRecoveryStrategies.handleAuthError,
        ErrorRecoveryStrategies.handleAPIError,
        ErrorRecoveryStrategies.handleNetworkError,
        ErrorRecoveryStrategies.handleStateError
      ];

      for (const strategy of strategies) {
        if (await strategy(error)) {
          return true;
        }
      }
    } catch {
      return false;
    }
    return false;
  }
};

export const ErrorBoundaryContext = React.createContext<{
  setError: (error: Error) => void;
  getErrorContext: () => ErrorContext | null;
}>({
  setError: () => {
    console.warn('ErrorBoundaryContext used outside of provider');
  },
  getErrorContext: () => null
});

export class ErrorBoundary extends React.Component<Props, State> {
  private recoveryTimeout: NodeJS.Timeout | null = null;
  
  constructor(props: Props) {
    super(props);
    this.state = { 
      error: null, 
      errorInfo: null, 
      errorCount: 0,
      lastError: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      error, 
      errorInfo: null,
      errorCount: 1,
      lastError: Date.now()
    };
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    logError(error, errorInfo, this.props.componentName);
    this.props.onError?.(error, errorInfo);

    // Attempt automatic recovery for certain errors
    if (this.state.errorCount < 3) {
      const recovered = await ErrorRecoveryStrategies.attemptRecovery(error);
      if (recovered) {
        this.handleReset();
      }
    }

    // If multiple errors occur in quick succession, force a full reload
    const timeSinceLastError = this.state.lastError ? Date.now() - this.state.lastError : Infinity;
    if (this.state.errorCount >= 3 && timeSinceLastError < 60000) {
      logError(
        new Error('Multiple errors detected, forcing reload'), 
        errorInfo,
        this.props.componentName
      );
      window.location.reload();
    }
  }

  componentWillUnmount() {
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
    }
  }

  handleReset = async () => {
    try {
      // Clear error state
      this.setState({ 
        error: null, 
        errorInfo: null,
        errorCount: 0,
        lastError: null
      });

      // Attempt to refresh data if available
      if ('mutate' in window) {
        await (window as any).mutate();
      }
    } catch (error) {
      logError(
        error instanceof Error ? error : new Error(String(error)), 
        undefined,
        this.props.componentName
      );
    }
  }

  setError = (error: Error) => {
    logError(error, undefined, this.props.componentName);
    this.setState(prevState => ({
      error,
      errorInfo: null,
      errorCount: prevState.errorCount + 1,
      lastError: Date.now()
    }));
  }

  getErrorContext = (): ErrorContext | null => {
    if (!this.state.error) return null;
    return getErrorContext(this.state.error, this.state.errorInfo || undefined);
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
            {process.env.NODE_ENV === 'development' && (
              <>
                <p className="text-xs text-muted-foreground">
                  エラー発生回数: {this.state.errorCount}
                </p>
                {this.state.errorInfo && (
                  <pre className="mt-2 text-xs overflow-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              className="mt-2 w-fit"
              disabled={this.state.errorCount >= 3}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {this.state.errorCount >= 3 ? 'ページを更新してください' : '再試行'}
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <ErrorBoundaryContext.Provider value={{ 
        setError: this.setError,
        getErrorContext: this.getErrorContext
      }}>
        {this.props.children}
      </ErrorBoundaryContext.Provider>
    );
  }
}

export function useErrorBoundary() {
  const context = React.useContext(ErrorBoundaryContext);
  
  const throwError = React.useCallback((error: Error | string) => {
    const errorObject = typeof error === 'string' ? new Error(error) : error;
    context.setError(errorObject);
  }, [context]);

  return {
    throwError,
    getErrorContext: context.getErrorContext
  };
}

// Type-safe wrapper for error boundary usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.FC<P> {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary componentName={componentName}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
