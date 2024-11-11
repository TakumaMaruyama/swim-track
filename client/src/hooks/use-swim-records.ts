import useSWR from "swr";
import type { SwimRecord } from "db/schema";

export function useSwimRecords(isCompetition?: boolean) {
  const endpoint = isCompetition ? '/api/records/competitions' : '/api/records';
  const { data: records, error, mutate } = useSWR<SwimRecord[]>(endpoint);

  return {
    records,
    isLoading: !error && !records,
    error,
    mutate
  };
}
