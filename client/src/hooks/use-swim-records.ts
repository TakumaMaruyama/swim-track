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
    dedupingInterval: 0, // Disable deduping
    revalidateIfStale: true,
    shouldRetryOnError: true,
    onError: (error) => {
      console.error('[Records] Cache error:', error);
      // Force revalidation on next request
      mutate(undefined, { revalidate: true });
    }
  });

  return {
    records,
    isLoading: !error && !records,
    error,
    mutate
  };
}
