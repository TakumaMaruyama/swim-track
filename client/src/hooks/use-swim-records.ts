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
    dedupingInterval: 5000, // Increased to prevent rapid updates
    revalidateIfStale: true,
    shouldRetryOnError: true,
    onError: (error) => {
      console.error('[Records] Cache error:', error);
      errorBoundary?.setError(error);
      mutate(undefined, { revalidate: true });
    }
  });

  // Add optimistic update function
  const optimisticUpdate = async (operation: 'create' | 'update' | 'delete', data: any) => {
    const previousData = records;
    try {
      // Update cache optimistically
      await mutate(
        operation === 'delete'
          ? records?.filter(r => r.id !== data.id)
          : operation === 'create'
          ? [...(records || []), data]
          : records?.map(r => (r.id === data.id ? { ...r, ...data } : r)),
        false
      );

      // Return cleanup function for rollback
      return () => mutate(previousData, false);
    } catch (error) {
      // Rollback on error
      await mutate(previousData, false);
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
