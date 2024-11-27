import useSWR from "swr";
import type { SwimRecord } from "db/schema";

export interface ExtendedSwimRecord {
  id: number;
  studentId: number;
  style: string;
  distance: number;
  time: string;
  date: Date | null;
  poolLength: number;
  athleteName: string;
  isCompetition: boolean;
  competitionName: string | null;
  competitionLocation: string | null;
}

const CACHE_TIME = 30 * 1000; // 30秒
const RETRY_COUNT = 3;
const TIMEOUT = 5000; // 5秒

export function useSwimRecords() {
  const { data: records, error, mutate, isValidating } = useSWR<ExtendedSwimRecord[]>(
    '/api/records',
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 0, // リアルタイム更新は不要
      dedupingInterval: 2000, // 2秒間は重複リクエストを防ぐ
      focusThrottleInterval: 5000, // フォーカス時の再取得を5秒間制限
      loadingTimeout: TIMEOUT,
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        // 404エラーはリトライしない
        if (error?.status === 404) return;

        // 認証エラーはリトライしない
        if (error?.status === 401) return;

        // 最大リトライ回数に達した場合はリトライしない
        if (retryCount >= RETRY_COUNT) return;

        // ネットワークエラーの場合は短い間隔でリトライ
        if (error?.name === 'NetworkError') {
          setTimeout(() => revalidate({ retryCount }), 1000);
          return;
        }

        // その他のエラーは徐々に間隔を広げてリトライ
        setTimeout(() => revalidate({ retryCount }), Math.min(1000 * 2 ** retryCount, 30000));
      },
      fetcher: async (url) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

          const response = await fetch(url, {
            credentials: 'include',
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '記録の取得に失敗しました');
          }

          const data = await response.json();
          return data;
        } catch (error) {
          if (error.name === 'AbortError') {
            throw new Error('リクエストがタイムアウトしました');
          }
          if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw new Error('ネットワークエラーが発生しました');
          }
          throw error;
        }
      },
    }
  );

  return {
    records,
    isLoading: !error && !records && !isValidating,
    isValidating,
    error: error ? {
      message: error instanceof Error ? error.message : '予期せぬエラーが発生しました'
    } : null,
    mutate,
  };
}
