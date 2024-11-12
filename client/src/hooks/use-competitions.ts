import useSWR from "swr";
import type { Competition } from "db/schema";

export function useCompetitions() {
  const { data: competitions, error, mutate } = useSWR<Competition[]>("/api/competitions");

  return {
    competitions,
    isLoading: !error && !competitions,
    error,
    mutate
  };
}
