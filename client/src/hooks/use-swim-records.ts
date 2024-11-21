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
  
  // Add error boundary context
  const errorBoundary = React.useContext(ErrorBoundaryContext);
  
  const { data: records, error, mutate } = useSWR<ExtendedSwimRecord[]>(endpoint, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 0, // Disable deduping to ensure immediate updates
    revalidateIfStale: true,
    shouldRetryOnError: true,
    refreshInterval: 1000, // Poll every second
    onSuccess: (data) => {
      console.log('[Records] Cache updated:', { timestamp: new Date().toISOString() });
    },
    onError: (error) => {
      console.error('[Records] Cache error:', error);
      errorBoundary?.setError(error);
      // Force immediate revalidation on error
      mutate(undefined, { 
        revalidate: true,
        populateCache: false
      });
    }
  });

  // Add optimistic update function with complete cache invalidation
  const optimisticUpdate = async (operation: 'create' | 'update' | 'delete', data: any) => {
    const previousData = records;
    
    try {
      // Immediately update local data
      const optimisticData = operation === 'delete'
        ? records?.filter(r => r.id !== data.id)
        : operation === 'create'
        ? [...(records || []), data]
        : records?.map(r => (r.id === data.id ? { ...r, ...data } : r));

      // Force immediate cache update
      await mutate(optimisticData, {
        revalidate: false, // Don't revalidate yet
        populateCache: true
      });

      // Return cleanup function
      return async () => {
        console.log('[Records] Rolling back optimistic update');
        await mutate(previousData, {
          revalidate: true,
          populateCache: true
        });
      };
    } catch (error) {
      // Rollback on error
      console.error('[Records] Optimistic update failed:', error);
      await mutate(previousData, {
        revalidate: true,
        populateCache: true
      });
      throw error;
    }
  };

  return {
    records,
    isLoading: !error && !records,
    error,
    mutate,
    optimisticUpdate
  };
}
