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

export function useSwimRecords() {
  const { data: records, error, mutate } = useSWR<ExtendedSwimRecord[]>('/api/records');

  return {
    records,
    isLoading: !error && !records,
    error,
    mutate
  };
}
