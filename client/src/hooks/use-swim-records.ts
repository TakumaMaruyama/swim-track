import React from 'react';
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

export function useSwimRecords() {
  const { data: records, error, mutate } = useSWR<ExtendedSwimRecord[]>('/api/records', {
    revalidateOnFocus: false,
    dedupingInterval: 2000,
    onError: (err) => {
      console.error('Error fetching swim records:', err);
    },
    shouldRetryOnError: true,
    errorRetryCount: 3,
    errorRetryInterval: 2000,
  });

  const refreshRecords = React.useCallback(async () => {
    try {
      console.log('Refreshing swim records...');
      // キャッシュを完全にクリアして再取得
      await mutate(undefined, {
        revalidate: true,
        rollbackOnError: true,
        populateCache: true,
        revalidateIfStale: true
      });
      console.log('Swim records refreshed successfully');
    } catch (error) {
      console.error('Error refreshing records:', error);
      // より詳細なエラー情報をログに出力
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      throw error;
    }
  }, [mutate]);

  return {
    records,
    isLoading: !error && !records,
    error,
    mutate: refreshRecords,
    // エラー状態をより詳細に提供
    errorDetails: error instanceof Error ? error.message : String(error)
  };
}
