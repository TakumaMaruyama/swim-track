type QualificationLevel = "national" | "kyushu" | "kagoshima";
type QualificationCourse = "SCM" | "LCM" | "ANY";
type SwimTrackGender = "male" | "female";
type ExternalGender = "M" | "F";

type AthleteSummary = {
  id: number;
  username: string;
  nameKana: string | null;
  gender: SwimTrackGender;
  birthDate: Date | null;
  isActive: boolean;
};

type CompetitionSummary = {
  id: number;
  name: string;
  location: string;
  date: Date | null;
  isQualificationTarget: boolean;
  qualifyingMeetId: string | null;
  qualifyingLevel: QualificationLevel | null;
  qualifyingSeason: number | null;
  qualifyingCourse: QualificationCourse | null;
};

type SwimRecordSummary = {
  id: number;
  studentId: number | null;
  style: string;
  distance: number;
  time: string;
  date: Date | null;
  poolLength: number;
};

type SearchMeetItem = {
  event_code: string;
  age: number;
  time: string;
};

type SearchMeetResult = {
  meet_id: string;
  meet_name: string;
  meet_season: number;
  meet_course: QualificationCourse;
  meet_date: string | null;
  meet_date_end: string | null;
  meet_metadata: Record<string, unknown> | null;
  items: SearchMeetItem[];
};

type SearchResponse = {
  targetAges: number[];
  season: number | null;
  course: QualificationCourse;
  gender: ExternalGender;
  results: Record<QualificationLevel, SearchMeetResult[]>;
};

export type QualifyingMeetListItem = {
  id: string;
  name: string;
  level: QualificationLevel;
  season: number;
  course: QualificationCourse;
  meetDate: string | null;
  meetDateEnd: string | null;
  metadata: Record<string, unknown> | null;
};

export type QualificationEventStatus =
  | "qualified"
  | "gap"
  | "age_missing"
  | "source_unavailable"
  | "standard_missing"
  | "no_official_record";

export type QualificationProgressEvent = {
  eventCode: string;
  eventLabel: string;
  style: string;
  distance: number;
  selectedPoolLength: number | null;
  currentBestTime: string | null;
  currentBestDate: string | null;
  standardTime: string | null;
  gapMs: number | null;
  status: QualificationEventStatus;
};

export type AthleteQualificationSummary = {
  athleteId: number;
  athleteName: string;
  nameKana: string | null;
  isActive: boolean;
  totalEventCount: number;
  qualifiedEventCount: number;
  summaryStatus: QualificationEventStatus;
  closestEvent: QualificationProgressEvent | null;
  events: QualificationProgressEvent[];
};

export type QualificationProgressCompetition = {
  competitionId: number;
  competitionName: string;
  competitionLocation: string;
  competitionDate: string | null;
  daysUntil: number | null;
  qualifyingMeetId: string | null;
  qualifyingLevel: QualificationLevel | null;
  qualifyingSeason: number | null;
  qualifyingCourse: QualificationCourse | null;
  athletes: AthleteQualificationSummary[];
};

export type QualificationProgressResponse = {
  targetCompetitions: QualificationProgressCompetition[];
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

type SelectedEvent = {
  eventCode: string;
  eventLabel: string;
  style: string;
  distance: number;
  selectedPoolLength: number;
  currentBestTime: string;
  currentBestDate: string | null;
  currentBestMs: number;
};

type StandardsLookup = {
  ageMaps: Map<number, Map<string, number>>;
  unavailable: boolean;
};

const STROKE_CODE_BY_STYLE: Record<string, string> = {
  自由形: "FR",
  背泳ぎ: "BK",
  平泳ぎ: "BR",
  バタフライ: "FL",
  個人メドレー: "IM",
};

const STROKE_ORDER: Record<string, number> = {
  自由形: 0,
  背泳ぎ: 1,
  平泳ぎ: 2,
  バタフライ: 3,
  個人メドレー: 4,
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 15 * 60 * 1000;

const searchCache = new Map<string, { expiresAt: number; value: SearchResponse }>();
const meetsCache = new Map<string, { expiresAt: number; value: QualifyingMeetListItem[] }>();

function getTokyoDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");

  return { year, month, day };
}

function calculateAgeAtDate(birthDate: Date | null, targetDate: Date | null) {
  if (!birthDate || !targetDate) {
    return null;
  }

  const birth = getTokyoDateParts(birthDate);
  const target = getTokyoDateParts(targetDate);

  let age = target.year - birth.year;
  if (target.month < birth.month || (target.month === birth.month && target.day < birth.day)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function genderToExternal(gender: SwimTrackGender): ExternalGender {
  return gender === "female" ? "F" : "M";
}

function toEventCode(style: string, distance: number) {
  const strokeCode = STROKE_CODE_BY_STYLE[style];
  if (!strokeCode) {
    return null;
  }

  return `${strokeCode}_${distance}`;
}

function parseTimeToMs(time: string | null) {
  if (!time) {
    return null;
  }

  const input = time.trim();
  if (!input) {
    return null;
  }

  const minuteMatch = /^(\d{1,3}):([0-5]?\d)\.(\d{1,2})$/.exec(input);
  if (minuteMatch) {
    const minutes = Number.parseInt(minuteMatch[1], 10);
    const seconds = Number.parseInt(minuteMatch[2], 10);
    const hundredths = Number.parseInt(minuteMatch[3].padEnd(2, "0"), 10);
    return (minutes * 60 + seconds) * 1000 + hundredths * 10;
  }

  const secondsMatch = /^(\d{1,3})\.(\d{1,2})$/.exec(input);
  if (secondsMatch) {
    const seconds = Number.parseInt(secondsMatch[1], 10);
    const hundredths = Number.parseInt(secondsMatch[2].padEnd(2, "0"), 10);
    return seconds * 1000 + hundredths * 10;
  }

  return null;
}

export function formatTimeMs(timeMs: number | null) {
  if (timeMs === null || !Number.isFinite(timeMs)) {
    return null;
  }

  const totalHundredths = Math.round(timeMs / 10);
  const minutes = Math.floor(totalHundredths / 6000);
  const seconds = Math.floor((totalHundredths % 6000) / 100);
  const hundredths = totalHundredths % 100;

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${hundredths
    .toString()
    .padStart(2, "0")}`;
}

function formatDateOnly(date: Date | null) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildEventLabel(style: string, distance: number, selectedPoolLength: number | null) {
  const suffix =
    selectedPoolLength === null
      ? ""
      : selectedPoolLength === 25
        ? " (25m)"
        : selectedPoolLength === 50
          ? " (50m)"
          : ` (${selectedPoolLength}m)`;

  return `${distance}m${style}${suffix}`;
}

function getPoolCourseLabel(poolLength: number): QualificationCourse | null {
  if (poolLength === 25) {
    return "SCM";
  }
  if (poolLength === 50) {
    return "LCM";
  }
  return null;
}

function selectBestEventsForCourse(
  records: SwimRecordSummary[],
  course: QualificationCourse | null,
) {
  const events = new Map<string, SelectedEvent>();

  for (const record of records) {
    if (!record.studentId) {
      continue;
    }

    const eventCode = toEventCode(record.style, record.distance);
    if (!eventCode) {
      continue;
    }

    const officialCourse = getPoolCourseLabel(record.poolLength);
    if (!officialCourse) {
      continue;
    }

    if (course === "SCM" && officialCourse !== "SCM") {
      continue;
    }

    if (course === "LCM" && officialCourse !== "LCM") {
      continue;
    }

    const currentBestMs = parseTimeToMs(record.time);
    if (currentBestMs === null) {
      continue;
    }

    const existing = events.get(eventCode);
    if (!existing || currentBestMs < existing.currentBestMs) {
      events.set(eventCode, {
        eventCode,
        eventLabel: buildEventLabel(record.style, record.distance, record.poolLength),
        style: record.style,
        distance: record.distance,
        selectedPoolLength: record.poolLength,
        currentBestTime: record.time,
        currentBestDate: formatDateOnly(record.date),
        currentBestMs,
      });
    }
  }

  return Array.from(events.values()).sort((a, b) => {
    const strokeOrderDiff =
      (STROKE_ORDER[a.style] ?? Number.MAX_SAFE_INTEGER) -
      (STROKE_ORDER[b.style] ?? Number.MAX_SAFE_INTEGER);
    if (strokeOrderDiff !== 0) {
      return strokeOrderDiff;
    }

    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }

    return a.selectedPoolLength - b.selectedPoolLength;
  });
}

function getDaysUntil(date: Date | null) {
  if (!date) {
    return null;
  }

  const target = getTokyoDateParts(date);
  const now = getTokyoDateParts(new Date());
  const targetUtc = Date.UTC(target.year, target.month - 1, target.day);
  const nowUtc = Date.UTC(now.year, now.month - 1, now.day);

  return Math.round((targetUtc - nowUtc) / DAY_IN_MS);
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`External API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchQualifyingMeets(
  baseUrl: string,
  filters: {
    level: QualificationLevel;
    season?: number | null;
    course?: QualificationCourse | null;
  },
) {
  const params = new URLSearchParams({ level: filters.level });
  if (typeof filters.season === "number") {
    params.set("season", String(filters.season));
  }
  if (filters.course) {
    params.set("course", filters.course);
  }

  const cacheKey = params.toString();
  const cached = meetsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const url = new URL("/api/meets", baseUrl);
  url.search = params.toString();

  const payload = await fetchJson<{ meets: QualifyingMeetListItem[] }>(url.toString());
  const meets = payload.meets ?? [];

  meetsCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value: meets,
  });

  return meets;
}

async function fetchStandards(
  baseUrl: string,
  input: {
    gender: ExternalGender;
    course: QualificationCourse;
    season: number | null;
    targetAges: number[];
  },
) {
  const cacheKey = JSON.stringify(input);
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const url = new URL("/api/search", baseUrl);
  const payload = await fetchJson<SearchResponse>(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  searchCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value: payload,
  });

  return payload;
}

function buildStandardsLookupFromMeet(meet: SearchMeetResult | null): StandardsLookup {
  if (!meet) {
    return {
      ageMaps: new Map(),
      unavailable: true,
    };
  }

  const ageMaps = new Map<number, Map<string, number>>();

  for (const item of meet.items) {
    const current = ageMaps.get(item.age) ?? new Map<string, number>();
    const parsed = parseTimeToMs(item.time);
    if (parsed !== null) {
      current.set(item.event_code, parsed);
      ageMaps.set(item.age, current);
    }
  }

  return {
    ageMaps,
    unavailable: false,
  };
}

async function buildCompetitionLookup(
  athletes: AthleteSummary[],
  competition: CompetitionSummary,
  baseUrl: string | undefined,
) {
  const unavailableLookup = {
    male: { ageMaps: new Map<number, Map<string, number>>(), unavailable: true },
    female: { ageMaps: new Map<number, Map<string, number>>(), unavailable: true },
  } satisfies Record<SwimTrackGender, StandardsLookup>;

  if (
    !baseUrl ||
    !competition.qualifyingMeetId ||
    !competition.qualifyingLevel ||
    !competition.qualifyingCourse
  ) {
    return unavailableLookup;
  }

  const result: Record<SwimTrackGender, StandardsLookup> = {
    male: { ageMaps: new Map(), unavailable: false },
    female: { ageMaps: new Map(), unavailable: false },
  };

  for (const gender of ["male", "female"] as const) {
    const ages = Array.from(
      new Set(
        athletes
          .filter((athlete) => athlete.gender === gender)
          .map((athlete) => calculateAgeAtDate(athlete.birthDate, competition.date))
          .filter((age): age is number => age !== null),
      ),
    ).sort((a, b) => a - b);

    if (ages.length === 0) {
      continue;
    }

    try {
      const payload = await fetchStandards(baseUrl, {
        gender: genderToExternal(gender),
        course: competition.qualifyingCourse,
        season: competition.qualifyingSeason,
        targetAges: ages,
      });

      const meet =
        payload.results[competition.qualifyingLevel].find(
          (item) => item.meet_id === competition.qualifyingMeetId,
        ) ?? null;

      result[gender] = buildStandardsLookupFromMeet(meet);
    } catch (error) {
      console.error("Failed to fetch qualifying standards:", error);
      result[gender] = {
        ageMaps: new Map(),
        unavailable: true,
      };
    }
  }

  return result;
}

function buildAthleteCompetitionSummary(params: {
  athlete: AthleteSummary;
  records: SwimRecordSummary[];
  competition: CompetitionSummary;
  lookup: Record<SwimTrackGender, StandardsLookup>;
}) {
  const selectedEvents = selectBestEventsForCourse(
    params.records,
    params.competition.qualifyingCourse,
  );

  if (selectedEvents.length === 0) {
    return {
      athleteId: params.athlete.id,
      athleteName: params.athlete.username,
      nameKana: params.athlete.nameKana,
      isActive: params.athlete.isActive,
      totalEventCount: 0,
      qualifiedEventCount: 0,
      summaryStatus: "no_official_record" as const,
      closestEvent: null,
      events: [],
    };
  }

  const athleteAge = calculateAgeAtDate(params.athlete.birthDate, params.competition.date);
  const standardsLookup = params.lookup[params.athlete.gender];
  const events: QualificationProgressEvent[] = selectedEvents.map((event) => {
    if (athleteAge === null) {
      return {
        ...event,
        standardTime: null,
        gapMs: null,
        status: "age_missing",
      };
    }

    if (standardsLookup.unavailable) {
      return {
        ...event,
        standardTime: null,
        gapMs: null,
        status: "source_unavailable",
      };
    }

    const ageStandards = standardsLookup.ageMaps.get(athleteAge);
    const standardMs = ageStandards?.get(event.eventCode);
    if (standardMs === undefined) {
      return {
        ...event,
        standardTime: null,
        gapMs: null,
        status: "standard_missing",
      };
    }

    const gapMs = event.currentBestMs - standardMs;
    return {
      ...event,
      standardTime: formatTimeMs(standardMs),
      gapMs,
      status: gapMs <= 0 ? "qualified" : "gap",
    };
  });

  const gapEvents = events
    .filter((event) => event.status === "gap" && event.gapMs !== null)
    .sort((a, b) => (a.gapMs ?? Number.MAX_SAFE_INTEGER) - (b.gapMs ?? Number.MAX_SAFE_INTEGER));
  const qualifiedEvents = events
    .filter((event) => event.status === "qualified" && event.gapMs !== null)
    .sort((a, b) => (b.gapMs ?? Number.MIN_SAFE_INTEGER) - (a.gapMs ?? Number.MIN_SAFE_INTEGER));

  let summaryStatus: QualificationEventStatus = "no_official_record";
  let closestEvent: QualificationProgressEvent | null = null;

  if (gapEvents.length > 0) {
    summaryStatus = "gap";
    closestEvent = gapEvents[0];
  } else if (qualifiedEvents.length === events.length) {
    summaryStatus = "qualified";
    closestEvent = qualifiedEvents[0] ?? null;
  } else if (events.some((event) => event.status === "age_missing")) {
    summaryStatus = "age_missing";
  } else if (events.some((event) => event.status === "source_unavailable")) {
    summaryStatus = "source_unavailable";
  } else if (events.some((event) => event.status === "standard_missing")) {
    summaryStatus = "standard_missing";
  }

  return {
    athleteId: params.athlete.id,
    athleteName: params.athlete.username,
    nameKana: params.athlete.nameKana,
    isActive: params.athlete.isActive,
    totalEventCount: events.length,
    qualifiedEventCount: qualifiedEvents.length,
    summaryStatus,
    closestEvent,
    events,
  };
}

function sortAthleteSummaries(a: AthleteQualificationSummary, b: AthleteQualificationSummary) {
  const priority = (summary: AthleteQualificationSummary) => {
    switch (summary.summaryStatus) {
      case "gap":
        return 0;
      case "qualified":
        return 1;
      case "age_missing":
      case "source_unavailable":
      case "standard_missing":
        return 2;
      case "no_official_record":
      default:
        return 3;
    }
  };

  const priorityDiff = priority(a) - priority(b);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  if (a.summaryStatus === "gap" && b.summaryStatus === "gap") {
    return (a.closestEvent?.gapMs ?? Number.MAX_SAFE_INTEGER) - (b.closestEvent?.gapMs ?? Number.MAX_SAFE_INTEGER);
  }

  if (a.summaryStatus === "qualified" && b.summaryStatus === "qualified") {
    return (b.closestEvent?.gapMs ?? Number.MIN_SAFE_INTEGER) - (a.closestEvent?.gapMs ?? Number.MIN_SAFE_INTEGER);
  }

  const aKey = a.nameKana || a.athleteName;
  const bKey = b.nameKana || b.athleteName;
  return aKey.localeCompare(bKey, "ja-JP", {
    sensitivity: "base",
    ignorePunctuation: true,
    usage: "sort",
  });
}

export async function buildQualificationProgress(params: {
  athletes: AthleteSummary[];
  competitions: CompetitionSummary[];
  records: SwimRecordSummary[];
  qualifyingTimesApiBaseUrl?: string;
}): Promise<QualificationProgressResponse> {
  const groupedRecords = new Map<number, SwimRecordSummary[]>();

  for (const record of params.records) {
    if (!record.studentId) {
      continue;
    }

    const current = groupedRecords.get(record.studentId) ?? [];
    current.push(record);
    groupedRecords.set(record.studentId, current);
  }

  const targetCompetitions = [];

  for (const competition of params.competitions) {
    if (!competition.isQualificationTarget) {
      continue;
    }

    const lookup = await buildCompetitionLookup(
      params.athletes,
      competition,
      params.qualifyingTimesApiBaseUrl,
    );

    const athletes = params.athletes
      .map((athlete) =>
        buildAthleteCompetitionSummary({
          athlete,
          competition,
          lookup,
          records: groupedRecords.get(athlete.id) ?? [],
        }),
      )
      .sort(sortAthleteSummaries);

    targetCompetitions.push({
      competitionId: competition.id,
      competitionName: competition.name,
      competitionLocation: competition.location,
      competitionDate: formatDateOnly(competition.date),
      daysUntil: getDaysUntil(competition.date),
      qualifyingMeetId: competition.qualifyingMeetId,
      qualifyingLevel: competition.qualifyingLevel,
      qualifyingSeason: competition.qualifyingSeason,
      qualifyingCourse: competition.qualifyingCourse,
      athletes,
    });
  }

  return { targetCompetitions };
}

export function buildImprovementSummary(params: {
  athleteId: number;
  months: number;
  records: SwimRecordSummary[];
}): ImprovementSummaryResponse {
  const relevantRecords = params.records.filter((record) => record.studentId === params.athleteId && record.date);
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

    const startCandidates = sorted.filter((record) => (record.date?.getTime() ?? 0) <= boundary.getTime());
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
      status:
        improvementMs > 0 ? "improved" : improvementMs < 0 ? "regressed" : "flat",
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
