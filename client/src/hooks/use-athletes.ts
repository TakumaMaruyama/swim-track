import useSWR from "swr";
import type { User } from "db/schema";

export function useAthletes() {
  const { data: athletes, error, mutate } = useSWR<User[]>("/api/athletes");

  const sortedAthletes = athletes?.slice().sort((a, b) => {
    const aKey = a.nameKana || a.username;
    const bKey = b.nameKana || b.username;
    return aKey.localeCompare(bKey, 'ja-JP', { 
      sensitivity: 'base',
      ignorePunctuation: true,
      usage: 'sort'
    });
  });

  return {
    athletes: sortedAthletes,
    isLoading: !error && !athletes,
    error,
    mutate
  };
}
