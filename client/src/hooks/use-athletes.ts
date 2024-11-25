import useSWR from "swr";
import type { User } from "db/schema";

export function useAthletes() {
  const { data: athletes, error, mutate } = useSWR<User[]>("/api/athletes");

  const sortedAthletes = athletes?.slice().sort((a, b) => {
    return a.username.localeCompare(b.username, 'ja-JP');
  });

  return {
    athletes: sortedAthletes,
    isLoading: !error && !athletes,
    error,
    mutate
  };
}
