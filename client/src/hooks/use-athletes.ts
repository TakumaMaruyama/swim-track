import useSWR from "swr";
import type { User } from "db/schema";

export function useAthletes() {
  const { data: athletes, error, mutate } = useSWR<User[]>("/api/athletes");

  return {
    athletes,
    isLoading: !error && !athletes,
    error,
    mutate
  };
}
