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
    // APIエラーの処理
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
    
    // Promiseエラーの処理
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { message: ERROR_MESSAGES.NETWORK_ERROR, name: 'NetworkError' };
    }
    
    // 認証エラーの処理
    if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
      return { message: ERROR_MESSAGES.UNAUTHORIZED, name: error.name };
    }

    // その他のネットワークエラー
    if (error.name === 'NetworkError' || error.message.includes('network')) {
      return { message: ERROR_MESSAGES.NETWORK_ERROR, name: error.name };
    }

    // カスタムエラーメッセージの処理
    const customMessage = error.message.match(/^Custom\[(.*)\]$/);
    if (customMessage) {
      return { message: customMessage[1], name: error.name };
    }

    return { message: error.message, name: error.name };
  }

  // Promise rejectionの処理
  if (typeof error === 'object' && error !== null && 'reason' in error) {
    return getErrorType((error as { reason: unknown }).reason);
  }

  return { message: ERROR_MESSAGES.DEFAULT };
}

// エラーメッセージのキャッシュと重複防止
const errorCache = new Map<string, { timestamp: number; count: number }>();
const TOAST_THROTTLE = 2000; // 2秒
const ERROR_CACHE_LIFETIME = 60000; // 1分
const MAX_DUPLICATE_ERRORS = 3; // 同じエラーの最大表示回数

function showThrottledToast(error: ErrorType) {
  const errorKey = `${error.name}-${error.message}`;
  const now = Date.now();
  const cached = errorCache.get(errorKey);

  // キャッシュのクリーンアップ
  for (const [key, value] of errorCache.entries()) {
    if (now - value.timestamp > ERROR_CACHE_LIFETIME) {
      errorCache.delete(key);
    }
  }

  // 新規エラーまたはキャッシュ期限切れの場合
  if (!cached || now - cached.timestamp > ERROR_CACHE_LIFETIME) {
    errorCache.set(errorKey, { timestamp: now, count: 1 });
    toast({
      variant: "destructive",
      title: "エラー",
      description: error.message,
    });
    return;
  }

  // エラーの重複チェックとレート制限
  if (cached.count < MAX_DUPLICATE_ERRORS && now - cached.timestamp > TOAST_THROTTLE) {
    cached.count++;
    cached.timestamp = now;
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
