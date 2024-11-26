import useSWR from "swr";
import type { Competition } from "db/schema";

export function useCompetitions() {
  const { data: competitions, error, mutate } = useSWR<Competition[]>("/api/competitions", {
    revalidateOnFocus: false,
    dedupingInterval: 2000,
  });

  return {
    competitions,
    isLoading: !error && !competitions,
    error,
    mutate: () => mutate(undefined, { revalidate: true })
  };
}
