import { toast } from "@/components/ui/use-toast";

// グローバルなPromiseエラーハンドラー
export function setupErrorHandlers() {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // ユーザーフレンドリーなエラーメッセージを表示
    toast({
      variant: "destructive",
      title: "エラーが発生しました",
      description: "操作を完了できませんでした。しばらく待ってから再度お試しください。"
    });

    // エラーイベントをキャンセルしてコンソールエラーを防ぐ
    event.preventDefault();
  });
}

// APIエラーを処理するユーティリティ関数
export function handleApiError(error: unknown) {
  console.error('API error:', error);
  
  const message = error instanceof Error 
    ? error.message 
    : '予期せぬエラーが発生しました';

  toast({
    variant: "destructive",
    title: "エラー",
    description: message
  });

  throw error;
}
