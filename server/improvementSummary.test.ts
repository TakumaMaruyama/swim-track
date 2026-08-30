import { afterEach, describe, expect, it, vi } from "vitest";

import { buildImprovementSummary } from "./improvementSummary";

describe("buildImprovementSummary", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("compares the earlier self-best with the current self-best for each event", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T00:00:00.000Z"));

    const summary = buildImprovementSummary({
      athleteId: 31,
      months: 6,
      records: [
        { id: 1, studentId: 31, style: "自由形", distance: 50, poolLength: 25, time: "00:31.230", date: new Date("2026-01-10T00:00:00.000Z") },
        { id: 2, studentId: 31, style: "自由形", distance: 50, poolLength: 25, time: "00:30.985", date: new Date("2026-08-10T00:00:00.000Z") },
        { id: 3, studentId: 31, style: "自由形", distance: 50, poolLength: 50, time: "00:32.00", date: new Date("2026-01-12T00:00:00.000Z") },
        { id: 4, studentId: 31, style: "自由形", distance: 50, poolLength: 50, time: "00:31.00", date: new Date("2026-08-12T00:00:00.000Z") },
        { id: 5, studentId: 99, style: "自由形", distance: 50, poolLength: 25, time: "00:20.00", date: new Date("2026-01-01T00:00:00.000Z") },
        { id: 6, studentId: 31, style: "背泳ぎ", distance: 100, poolLength: 25, time: "01:03.00", date: new Date("2026-08-01T00:00:00.000Z") },
      ],
    });

    expect(summary.items).toHaveLength(2);
    expect(summary.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventLabel: "50m自由形 (25m)",
        startBestTime: "00:31.230",
        currentBestTime: "00:30.985",
        improvementMs: 245,
        status: "improved",
      }),
      expect.objectContaining({
        eventLabel: "50m自由形 (50m)",
        startBestTime: "00:32.00",
        currentBestTime: "00:31.00",
        improvementMs: 1000,
        status: "improved",
      }),
    ]));
    expect(summary.items.find((item) => item.poolLength === 25)?.improvementRate).toBeCloseTo(0.7845, 3);
    expect(summary.items.some((item) => item.style === "背泳ぎ")).toBe(false);
  });
});
