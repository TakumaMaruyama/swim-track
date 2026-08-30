import { describe, expect, it } from "vitest";
import { calculateIMRankings, calculateGrowthRankings } from "./rankingCalculations";
import type { ExtendedSwimRecord } from "@/hooks/use-swim-records";

const record = (overrides: Partial<ExtendedSwimRecord>): ExtendedSwimRecord => ({
  id: 1,
  studentId: 42,
  style: "個人メドレー",
  distance: 60,
  time: "00:50.00",
  date: new Date("2025-02-10"),
  poolLength: 15,
  athleteName: "山田 太郎",
  isCompetition: false,
  competition: null,
  competitionName: null,
  competitionLocation: null,
  gender: "male",
  athleteJoinDate: null,
  athleteAllTimeStartDate: null,
  ...overrides,
});

describe("ranking calculation regressions", () => {
  it("keeps record IDs/student IDs and displayed Japanese names intact while ranking", () => {
    const source = record({ id: 99, studentId: 77, athleteName: "山田\u3000太郎" });
    const result = calculateIMRankings([source], 2025, 2);

    expect(source.studentId).toBe(77);
    expect(source.id).toBe(99);
    expect(result["60m"].male[0]).toMatchObject({
      rank: 1,
      athleteName: "山田\u3000太郎",
      time: "00:50.00",
    });
  });

  it("calculates growth without changing source athlete identity fields", () => {
    const earlier = record({ id: 1, studentId: 7, athleteName: "佐藤 花子", date: new Date("2024-12-10"), time: "01:00.00" });
    const current = record({ id: 2, studentId: 7, athleteName: "佐藤 花子", date: new Date("2025-02-10"), time: "00:50.00" });
    const result = calculateGrowthRankings([earlier, current]);

    expect(result?.rankings["60m"].male[0]).toMatchObject({
      studentId: 7,
      athleteName: "佐藤 花子",
      rank: 1,
    });
    expect(earlier.athleteName).toBe("佐藤 花子");
    expect(current.studentId).toBe(7);
  });
});