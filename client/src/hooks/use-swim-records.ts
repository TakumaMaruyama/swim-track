import useSWR from "swr";
import type { SwimRecord } from "db/schema";

export interface ExtendedSwimRecord {
  id: number;
  studentId: number;
  style: string;
  distance: number;
  time: string;
  date: Date | null;
  poolLength: number;
  athleteName: string;
  isCompetition: boolean;
  competitionName: string | null;
  competitionLocation: string | null;
}

export function useSwimRecords() {
  const { data: records, error, mutate } = useSWR<ExtendedSwimRecord[]>('/api/records', {
    revalidateOnFocus: false,
    dedupingInterval: 2000,
    onError: (err) => {
      console.error('Error fetching swim records:', err);
    }
  });

  const refreshRecords = React.useCallback(async () => {
    try {
      console.log('Refreshing swim records...');
      // 強制的に再検証を行い、キャッシュを無効化
      await mutate(undefined, {
        revalidate: true,
        rollbackOnError: true,
        populateCache: true,
        revalidateIfStale: true
      });
      console.log('Swim records refreshed successfully');
    } catch (error) {
      console.error('Error refreshing records:', error);
      throw error; // エラーを上位に伝播させる
    }
  }, [mutate]);

  return {
    records,
    isLoading: !error && !records,
    error,
    mutate: refreshRecords
  };
}
