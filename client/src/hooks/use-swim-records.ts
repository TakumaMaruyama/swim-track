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
  competition: string | null;  // For backward compatibility
  competitionName: string | null;
  competitionLocation: string | null;
}

export function useSwimRecords() {
  const fetcher = async (url: string) => {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const error = new Error('データの取得に失敗しました');
      error.cause = await response.json();
      throw error;
    }
    
    return response.json();
  };

  const { data: records, error, mutate } = useSWR<ExtendedSwimRecord[]>(
    '/api/records',
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      onError: (err) => {
        console.error('Error fetching swim records:', err);
        if (err instanceof Error) {
          console.error('Error details:', {
            message: err.message,
            cause: err.cause,
            name: err.name
          });
        }
      },
      shouldRetryOnError: true,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
      suspense: false,
      keepPreviousData: true,
      refreshWhenHidden: false,
      refreshInterval: 0
    }
  );

  const refreshRecords = React.useCallback(async () => {
    try {
      console.log('Refreshing swim records...');
      // Clear cache and revalidate
      await mutate(undefined, {
        revalidate: true,
        populateCache: true,
        rollbackOnError: false
      });
      console.log('Swim records refreshed successfully');
    } catch (error) {
      console.error('Error refreshing records:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          cause: error.cause
        });
      }
      throw new Error('記録の更新に失敗しました');
    }
  }, [mutate]);

  return {
    records,
    isLoading: !error && !records,
    error,
    mutate: refreshRecords,
    errorDetails: error instanceof Error 
      ? error.message 
      : 'データの取得中にエラーが発生しました'
  };
}
