import useSWR from "swr";
import type { Competition } from "db/schema";

export function useCompetitions() {
  const { data: competitions, error, mutate } = useSWR<Competition[]>("/api/competitions", {
    revalidateOnFocus: true,
    revalidateOnMount: true,
    refreshInterval: 0,
    shouldRetryOnError: true,
    errorRetryCount: 3
  });

  return {
    competitions,
    isLoading: !error && !competitions,
    error,
    mutate: () => mutate(undefined, { 
      revalidate: true,
      populateCache: true,
      rollbackOnError: true 
    })
  };
}
