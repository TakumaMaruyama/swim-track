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

  private cleanupTimeout?: number;
  private mounted: boolean = false;

  public componentDidMount() {
    this.mounted = true;
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    // エラー状態を自動リセット (デバウンス付き)
    if (this.cleanupTimeout) {
      window.clearTimeout(this.cleanupTimeout);
    }
    
    this.cleanupTimeout = window.setTimeout(() => {
      if (this.mounted) {
        this.setState({ hasError: false });
      }
    }, 5000) as unknown as number;

    // エラーの種類に応じて適切な処理を実行
    if (error instanceof TypeError && error.message.includes('hooks')) {
      // Hooksエラーの場合はコンポーネントをリマウント
      this.setState({ hasError: true }, () => {
        setTimeout(() => {
          if (this.mounted) {
            this.setState({ hasError: false });
          }
        }, 100);
      });
    } else if (error.name === 'ChunkLoadError' || error.message.includes('loading chunk')) {
      // チャンクロードエラーの場合はページをリロード
      window.location.reload();
    } else {
      this.setState({ hasError: true });
    }
  }

  public componentWillUnmount() {
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
