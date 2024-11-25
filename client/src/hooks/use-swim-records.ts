import useSWR from "swr";
import type { SwimRecord } from "db/schema";

export interface ExtendedSwimRecord {
  id: number;
  studentId: number;
  style: string;
  distance: number;
  time: string;
  date: Date | null;
  isCompetition: boolean | null;
  poolLength: number;
  competitionId: number | null;
  athleteName: string;
}

export function useSwimRecords(isCompetition?: boolean) {
  const endpoint = isCompetition ? '/api/records/competitions' : '/api/records';
  const { data: records, error, mutate } = useSWR<ExtendedSwimRecord[]>(endpoint);

  return {
    records,
    isLoading: !error && !records,
    error,
    mutate
  };
}
