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
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      // Never retry on 404
      if (error.status === 404) return;

      // Retry up to 3 times
      if (retryCount >= 3) return;

      // Retry after 3 seconds
      setTimeout(() => revalidate({ retryCount }), 3000);
    }
  });

  const optimisticUpdate = async (
    operation: 'create' | 'update' | 'delete',
    recordData: Partial<ExtendedSwimRecord> & { id?: number }
  ) => {
    if (!records) return;

    // Create optimistic data based on operation
    let optimisticData: ExtendedSwimRecord[];
    
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
        return;
    }

    // Perform optimistic update
    await mutate(optimisticData, false);
  };

  return {
    records,
    isLoading: !error && !records,
    error,
    mutate,
    optimisticUpdate
  };
}
