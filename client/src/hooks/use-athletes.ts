import useSWR from "swr";
import type { User } from "db/schema";

export function useAthletes() {
  const { data: athletes, error, mutate } = useSWR<User[]>("/api/athletes");

  const sortedAthletes = athletes?.slice().sort((a, b) => {
    // 1. フリガナが両方ある場合はフリガナで比較
    if (a.furigana && b.furigana) {
      return a.furigana.localeCompare(b.furigana, 'ja-JP');
    }
    // 2. フリガナがある方を先に表示
    if (a.furigana) return -1;
    if (b.furigana) return 1;
    // 3. どちらもフリガナがない場合は名前で比較
    return a.username.localeCompare(b.username, 'ja-JP');
  });

  return {
    athletes: sortedAthletes,
    isLoading: !error && !athletes,
    error,
    mutate
  };
}
