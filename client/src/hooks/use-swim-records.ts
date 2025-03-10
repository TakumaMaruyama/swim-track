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
  gender: 'male' | 'female';
}

export function useSwimRecords() {
  const { data: records, error, mutate } = useSWR<ExtendedSwimRecord[]>(
    '/api/records',
    {
      revalidateOnFocus: false,
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
    }
  );

  const refreshRecords = React.useCallback(async () => {
    try {
      await mutate(undefined, {
        revalidate: true,
        rollbackOnError: true,
        throwOnError: false
      });
      return true;
    } catch (error) {
      console.error('Error refreshing records:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          cause: error.cause
        });
      }
      return false;
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