import React, { Component, ErrorInfo } from 'react';
import { useErrorStore } from '../../stores/error';
import { useToastStore } from '../../stores/toast';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // エラー情報をストアに記録
    useErrorStore.getState().addError('global', error.message);
    
    // トースト通知を表示
    useToastStore.getState().addToast({
      type: 'error',
      message: 'エラーが発生しました。ページを再読み込みしてください。',
      duration: 5000,
    });

    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h2 className="text-lg font-semibold text-red-700">エラーが発生しました</h2>
          <p className="mt-2 text-red-600">
            申し訳ありませんが、エラーが発生しました。ページを再読み込みしてください。
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
