import useSWR from 'swr';

type RecentActivity = {
  id: number;
  type: 'competition' | 'record';
  date: string;
  details: {
    name?: string;
    location?: string;
    style?: string;
    distance?: number;
    time?: string;
    athleteName?: string;
  };
};

export function useRecentActivities() {
  const { data, error, mutate } = useSWR<RecentActivity[]>('/api/recent-activities');

  return {
    activities: data,
    isLoading: !error && !data,
    error,
    mutate,
  };
}
