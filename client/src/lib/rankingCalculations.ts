import { ExtendedSwimRecord } from '@/hooks/use-swim-records';

export type RankingRecord = {
  rank: number;
  athleteName: string;
  time: string;
  date: Date;
};

export type GrowthRecord = {
  rank: number;
  athleteName: string;
  studentId: number;
  bestTime: string;
  currentTime: string;
  growthRate: number;
  improvementSeconds: number;
  bestDate: Date;
  currentDate: Date;
};

export type IMRankingsData = {
  '60m': {
    male: RankingRecord[];
    female: RankingRecord[];
  };
  '120m': {
    male: RankingRecord[];
    female: RankingRecord[];
  };
};

export type GrowthRankingsData = {
  periods: {
    current: { year: number; month: number };
    previous: { year: number; month: number };
  };
  rankings: {
    '60m': {
      male: GrowthRecord[];
      female: GrowthRecord[];
    };
    '120m': {
      male: GrowthRecord[];
      female: GrowthRecord[];
    };
  };
};

export function getLatestEvenMonth(): { year: number; month: number } {
  const now = new Date();
  let currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  let targetMonth = currentMonth % 2 === 0 ? currentMonth : currentMonth - 1;

  if (targetMonth === 0) {
    targetMonth = 12;
    currentYear = currentYear - 1;
  }

  return { year: currentYear, month: targetMonth };
}

export function getLatestTwoEvenMonths(records: ExtendedSwimRecord[]): {
  current: { year: number; month: number } | null;
  previous: { year: number; month: number } | null;
} {
  const evenMonths = records
    .filter(
      (record) =>
        record.style === '個人メドレー' && record.poolLength === 15 && record.date
    )
    .map((record) => {
      const date = new Date(record.date!);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      if (month % 2 === 0) {
        return { year, month, timestamp: date.getTime() };
      }
      return null;
    })
    .filter((item) => item !== null) as {
    year: number;
    month: number;
    timestamp: number;
  }[];

  const uniqueMonths = Array.from(
    new Map(evenMonths.map((item) => [`${item.year}-${item.month}`, item])).values()
  ).sort((a, b) => b.timestamp - a.timestamp);

  if (uniqueMonths.length < 2) {
    return { current: null, previous: null };
  }

  return {
    current: { year: uniqueMonths[0].year, month: uniqueMonths[0].month },
    previous: { year: uniqueMonths[1].year, month: uniqueMonths[1].month },
  };
}

export function timeToSeconds(time: string): number {
  const [minutes, seconds] = time.split(':').map(parseFloat);
  return minutes * 60 + seconds;
}

export function calculateIMRankings(
  records: ExtendedSwimRecord[],
  year: number,
  month: number
): IMRankingsData {
  const imRecords = records.filter((record) => {
    if (record.style !== '個人メドレー') return false;
    if (record.poolLength !== 15) return false;
    if (!record.date) return false;

    const recordDate = new Date(record.date);
    const recordYear = recordDate.getFullYear();
    const recordMonth = recordDate.getMonth() + 1;

    return recordYear === year && recordMonth === month;
  });

  const createRanking = (
    distance: number,
    gender: 'male' | 'female'
  ): RankingRecord[] => {
    const filtered = imRecords
      .filter((r) => r.distance === distance && r.gender === gender)
      .sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time))
      .slice(0, 3);

    return filtered.map((record, index) => ({
      rank: index + 1,
      athleteName: record.athleteName || '不明',
      time: record.time,
      date: new Date(record.date!),
    }));
  };

  return {
    '60m': {
      male: createRanking(60, 'male'),
      female: createRanking(60, 'female'),
    },
    '120m': {
      male: createRanking(120, 'male'),
      female: createRanking(120, 'female'),
    },
  };
}

export function calculateGrowthRankings(
  records: ExtendedSwimRecord[]
): GrowthRankingsData | null {
  const { current: currentPeriod, previous: previousPeriod } =
    getLatestTwoEvenMonths(records);

  if (!currentPeriod || !previousPeriod) {
    return null;
  }

  const imRecords = records.filter(
    (record) =>
      record.style === '個人メドレー' && record.poolLength === 15 && record.date
  );

  const currentRecords = imRecords.filter((record) => {
    const recordDate = new Date(record.date!);
    return (
      recordDate.getFullYear() === currentPeriod.year &&
      recordDate.getMonth() + 1 === currentPeriod.month
    );
  });

  const calculateGrowth = (
    distance: number,
    gender: 'male' | 'female'
  ): GrowthRecord[] => {
    const currentFiltered = currentRecords.filter(
      (r) => r.distance === distance && r.gender === gender
    );

    const growthData: GrowthRecord[] = [];

    currentFiltered.forEach((currentRecord) => {
      const athleteRecords = imRecords.filter(
        (r) =>
          r.studentId === currentRecord.studentId &&
          r.distance === distance &&
          r.gender === gender &&
          r.id !== currentRecord.id
      );

      if (athleteRecords.length === 0) return;

      const bestRecord = athleteRecords.reduce((best, current) => {
        const bestSeconds = timeToSeconds(best.time);
        const currentSeconds = timeToSeconds(current.time);
        return currentSeconds < bestSeconds ? current : best;
      });

      const currentSeconds = timeToSeconds(currentRecord.time);
      const bestSeconds = timeToSeconds(bestRecord.time);

      const improvementSeconds = bestSeconds - currentSeconds;
      const growthRate = (improvementSeconds / bestSeconds) * 100;

      growthData.push({
        rank: 0,
        athleteName: currentRecord.athleteName || '不明',
        studentId: currentRecord.studentId!,
        bestTime: bestRecord.time,
        currentTime: currentRecord.time,
        growthRate,
        improvementSeconds,
        bestDate: new Date(bestRecord.date!),
        currentDate: new Date(currentRecord.date!),
      });
    });

    return growthData
      .sort((a, b) => b.growthRate - a.growthRate)
      .map((record, index) => ({ ...record, rank: index + 1 }));
  };

  return {
    periods: {
      current: currentPeriod,
      previous: previousPeriod,
    },
    rankings: {
      '60m': {
        male: calculateGrowth(60, 'male'),
        female: calculateGrowth(60, 'female'),
      },
      '120m': {
        male: calculateGrowth(120, 'male'),
        female: calculateGrowth(120, 'female'),
      },
    },
  };
}
