import useSWR from "swr";
import type { SwimRecord } from "db/schema";

export interface ExtendedSwimRecord extends Omit<SwimRecord, 'studentId'> {
  studentId: number;
  athleteName: string;
}

export function useSwimRecords(isCompetition?: boolean) {
  const endpoint = isCompetition ? '/api/records/competitions' : '/api/records';
  const { data: records, error, mutate } = useSWR<ExtendedSwimRecord[]>(endpoint, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 1000, // Reduced to ensure quicker updates
    errorRetryCount: 3,
    errorRetryInterval: 3000,
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      // Never retry on 404, 403, or 422
      if (error.status === 404 || error.status === 403 || error.status === 422) return;

      // Retry up to 3 times with exponential backoff
      if (retryCount >= 3) return;
      setTimeout(() => revalidate({ retryCount }), Math.min(1000 * (2 ** retryCount), 30000));
    },
    // Add proper error boundaries
    onError: (error) => {
      console.error('SWR Error:', error);
      // Force revalidation on next request
      mutate(undefined, { revalidate: true });
    },
    // Handle race conditions
    keepPreviousData: true,
    // Ensure data consistency
    compare: (a, b) => {
      if (!a || !b) return false;
      return JSON.stringify(a) === JSON.stringify(b);
    }
  });

  const optimisticUpdate = async (
    operation: 'create' | 'update' | 'delete',
    recordData: Partial<ExtendedSwimRecord> & { id?: number },
    options?: { 
      rollbackOnError?: boolean;
      revalidate?: boolean;
      forceRevalidate?: boolean;
    }
  ): Promise<{ success: boolean; error?: Error }> => {
    if (!records) return { success: false, error: new Error('No records available') };

    const previousData = [...records];
    let optimisticData: ExtendedSwimRecord[];
    
    try {
      // Create optimistic data based on operation
      switch (operation) {
        case 'create':
          optimisticData = [...records, recordData as ExtendedSwimRecord];
          break;
        case 'update':
          optimisticData = records.map(record =>
            record.id === recordData.id ? { ...record, ...recordData } : record
          );
          break;
        case 'delete':
          optimisticData = records.filter(record => record.id !== recordData.id);
          break;
        default:
          throw new Error(`Invalid operation: ${operation}`);
      }

      // Perform optimistic update
      await mutate(optimisticData, false);

      // Always revalidate after successful operation, with force option
      if (options?.revalidate || options?.forceRevalidate) {
        await mutate(undefined, { 
          revalidate: true,
          populateCache: true,
          rollbackOnError: options?.rollbackOnError
        });
      }

      return { success: true };
    } catch (error) {
      // Rollback on error if specified
      if (options?.rollbackOnError) {
        await mutate(previousData, false);
      }

      // Always revalidate on error to ensure consistency
      await mutate(undefined, { revalidate: true });

      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to update records')
      };
    }
  };

  const revalidateCache = async () => {
    try {
      await mutate(undefined, { revalidate: true });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to revalidate cache')
      };
    }
  };

  return {
    records,
    isLoading: !error && !records,
    error,
    mutate,
    optimisticUpdate,
    revalidateCache
  };
}
