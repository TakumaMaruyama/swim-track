import React from 'react';
import useSWR from "swr";
import type { SwimRecord } from "db/schema";
import { ErrorBoundaryContext } from "../components/ErrorBoundary";

export interface ExtendedSwimRecord extends Omit<SwimRecord, 'studentId'> {
  studentId: number;
  athleteName: string;
}

export function useSwimRecords(isCompetition?: boolean) {
  const endpoint = isCompetition ? '/api/records/competitions' : '/api/records';
  
  const errorBoundary = React.useContext(ErrorBoundaryContext);
  
  const { data: records, error, mutate } = useSWR<ExtendedSwimRecord[]>(endpoint, {
    revalidateOnFocus: false,  // Prevent unnecessary revalidation
    revalidateOnReconnect: true,
    dedupingInterval: 0,  // Disable deduping completely
    revalidateIfStale: true,
    shouldRetryOnError: true,
    onSuccess: (data) => {
      console.log('[Records] Cache updated:', { 
        timestamp: new Date().toISOString(),
        recordCount: data?.length
      });
    },
    onError: (error) => {
      console.error('[Records] Cache error:', error);
      errorBoundary?.setError(error);
    }
  });

  // Implement aggressive cache management
  const forceRefresh = async () => {
    console.log('[Records] Forcing cache refresh');
    await mutate(undefined, { 
      revalidate: true,
      populateCache: false  // Don't use stale data
    });
  };

  return {
    records,
    isLoading: !error && !records,
    error,
    mutate,
    forceRefresh  // Expose force refresh method
  };
}
