import useSWR from "swr";
import type { Competition } from "db/schema";

const fetcher = async (url: string) => {
  const response = await fetch(url, {
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error('Failed to fetch competitions');
  }
  return response.json();
};

export function useCompetitions() {
  const { data, error, mutate } = useSWR<Competition[]>(
    "/api/competitions",
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnMount: true,
      dedupingInterval: 0,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      onError: (error) => {
        console.error('Competitions fetch error:', error);
      },
      onSuccess: (data) => {
        console.log('Competitions fetched successfully:', data);
      }
    }
  );

  return {
    competitions: data,
    isLoading: !error && !data,
    error,
    mutate
  };
}
