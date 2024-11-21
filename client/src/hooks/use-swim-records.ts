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
    dedupingInterval: 2000,
    errorRetryCount: 3,
    errorRetryInterval: 3000,
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      // Never retry on 404 or 403
      if (error.status === 404 || error.status === 403) return;

      // Retry up to 3 times with exponential backoff
      if (retryCount >= 3) return;
      setTimeout(() => revalidate({ retryCount }), Math.min(1000 * (2 ** retryCount), 30000));
    }
  });

  const optimisticUpdate = async (
    operation: 'create' | 'update' | 'delete',
    recordData: Partial<ExtendedSwimRecord> & { id?: number },
    options?: { 
      rollbackOnError?: boolean;
      revalidate?: boolean;
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

      // If revalidate is true, trigger a revalidation after the optimistic update
      if (options?.revalidate) {
        await mutate(undefined, { revalidate: true });
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
