type SwimRecordSummary = {
  id: number;
  studentId: number | null;
  style: string;
  distance: number;
  time: string;
  date: Date | null;
  poolLength: number;
};

export type ImprovementSummaryItem = {
  style: string;
  distance: number;
  poolLength: number;
  eventLabel: string;
  startBestTime: string;
  currentBestTime: string;
  improvementMs: number;
  improvementRate: number;
  status: "improved" | "flat" | "regressed";
};

export type ImprovementSummaryResponse = {
  athleteId: number;
  months: number;
  items: ImprovementSummaryItem[];
};

function parseTimeToMs(time: string | null) {
  if (!time) {
    return null;
  }

  const match = /^(\d{1,3}):([0-5]?\d)\.(\d{1,3})$/.exec(time.trim());
  if (!match) {
    return null;
  }

  const minutes = Number.parseInt(match[1], 10);
  const seconds = Number.parseInt(match[2], 10);
  const milliseconds = Number.parseInt(match[3].padEnd(3, "0"), 10);
  return (minutes * 60 + seconds) * 1000 + milliseconds;
}

function buildEventLabel(style: string, distance: number, poolLength: number) {
  return `${distance}m${style} (${poolLength}m)`;
}

export function buildImprovementSummary(params: {
  athleteId: number;
  months: number;
  records: SwimRecordSummary[];
}): ImprovementSummaryResponse {
  const relevantRecords = params.records.filter(
    (record) => record.studentId === params.athleteId && record.date,
  );
  const boundary = new Date();
  boundary.setMonth(boundary.getMonth() - params.months);

  const eventGroups = new Map<string, SwimRecordSummary[]>();
  for (const record of relevantRecords) {
    const key = `${record.style}::${record.distance}::${record.poolLength}`;
    const current = eventGroups.get(key) ?? [];
    current.push(record);
    eventGroups.set(key, current);
  }

  const items: ImprovementSummaryItem[] = [];

  for (const records of eventGroups.values()) {
    const sorted = [...records].sort((a, b) => {
      const aDate = a.date?.getTime() ?? 0;
      const bDate = b.date?.getTime() ?? 0;
      return aDate - bDate;
    });

    const startCandidates = sorted.filter(
      (record) => (record.date?.getTime() ?? 0) <= boundary.getTime(),
    );
    if (startCandidates.length === 0) {
      continue;
    }

    const startBest = startCandidates.reduce((best, current) => {
      const bestMs = parseTimeToMs(best.time) ?? Number.MAX_SAFE_INTEGER;
      const currentMs = parseTimeToMs(current.time) ?? Number.MAX_SAFE_INTEGER;
      return currentMs < bestMs ? current : best;
    });

    const currentBest = sorted.reduce((best, current) => {
      const bestMs = parseTimeToMs(best.time) ?? Number.MAX_SAFE_INTEGER;
      const currentMs = parseTimeToMs(current.time) ?? Number.MAX_SAFE_INTEGER;
      return currentMs < bestMs ? current : best;
    });

    const startBestMs = parseTimeToMs(startBest.time);
    const currentBestMs = parseTimeToMs(currentBest.time);
    if (startBestMs === null || currentBestMs === null) {
      continue;
    }

    const improvementMs = startBestMs - currentBestMs;
    const improvementRate = startBestMs === 0 ? 0 : (improvementMs / startBestMs) * 100;
    items.push({
      style: currentBest.style,
      distance: currentBest.distance,
      poolLength: currentBest.poolLength,
      eventLabel: buildEventLabel(currentBest.style, currentBest.distance, currentBest.poolLength),
      startBestTime: startBest.time,
      currentBestTime: currentBest.time,
      improvementMs,
      improvementRate,
      status: improvementMs > 0 ? "improved" : improvementMs < 0 ? "regressed" : "flat",
    });
  }

  items.sort((a, b) => {
    if (b.improvementMs !== a.improvementMs) {
      return b.improvementMs - a.improvementMs;
    }

    return a.eventLabel.localeCompare(b.eventLabel, "ja-JP");
  });

  return {
    athleteId: params.athleteId,
    months: params.months,
    items,
  };
}
