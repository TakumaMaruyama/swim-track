import { toast } from "@/components/ui/use-toast";
import { useCallback } from "react";

// エラータイプの定義
type ErrorType = {
  name?: string;
  message: string;
  code?: string;
  status?: number;
};

// エラーメッセージのマッピング
const ERROR_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: "ネットワーク接続に問題が発生しました。インターネット接続を確認してください。",
  UNAUTHORIZED: "認証が必要です。再度ログインしてください。",
  FORBIDDEN: "このアクションを実行する権限がありません。",
  NOT_FOUND: "要求されたリソースが見つかりません。",
  VALIDATION_ERROR: "入力内容に誤りがあります。",
  SERVER_ERROR: "サーバーエラーが発生しました。しばらく待ってから再度お試しください。",
  DEFAULT: "予期せぬエラーが発生しました。しばらく待ってから再度お試しください。"
};

// エラーの種類を判定する関数
function getErrorType(error: unknown): ErrorType {
  if (error instanceof Error) {
    if ('status' in error) {
      const status = (error as any).status;
      switch (status) {
        case 401: return { message: ERROR_MESSAGES.UNAUTHORIZED, status };
        case 403: return { message: ERROR_MESSAGES.FORBIDDEN, status };
        case 404: return { message: ERROR_MESSAGES.NOT_FOUND, status };
        case 422: return { message: ERROR_MESSAGES.VALIDATION_ERROR, status };
        case 500: return { message: ERROR_MESSAGES.SERVER_ERROR, status };
      }
    }
    if (error.name === 'NetworkError') {
      return { message: ERROR_MESSAGES.NETWORK_ERROR, name: error.name };
    }
    return { message: error.message, name: error.name };
  }
  return { message: ERROR_MESSAGES.DEFAULT };
}

// レート制限付きトースト表示
let lastToastTime = 0;
const TOAST_THROTTLE = 2000; // 2秒

function showThrottledToast(error: ErrorType) {
  const now = Date.now();
  if (now - lastToastTime > TOAST_THROTTLE) {
    lastToastTime = now;
    toast({
      variant: "destructive",
      title: "エラー",
      description: error.message,
    });
  }
}

// グローバルなPromiseエラーハンドラー
export function setupErrorHandlers() {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    const error = getErrorType(event.reason);
    showThrottledToast(error);

    // エラーイベントをキャンセルしてコンソールエラーを防ぐ
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    const error = getErrorType(event.error);
    showThrottledToast(error);
  });
}

// APIエラーを処理するユーティリティ関数
export function handleApiError(error: unknown) {
  console.error('API error:', error);
  
  const errorType = getErrorType(error);
  showThrottledToast(errorType);

  throw error;
}

// Reactコンポーネント用のエラーハンドリングフック
export function useErrorHandler() {
  return useCallback((error: unknown) => {
    const errorType = getErrorType(error);
    showThrottledToast(errorType);
  }, []);
}
