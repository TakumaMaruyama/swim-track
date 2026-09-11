// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IMRankings from "./IMRankings";
import GrowthRankings from "./GrowthRankings";
import type { GrowthRankingsData, IMRankingsData } from "@/lib/rankingCalculations";

const state = vi.hoisted(() => ({
  imRankings: {
    "60m": { male: [], female: [] },
    "120m": { male: [], female: [] },
  } as IMRankingsData,
  growthRankings: null as GrowthRankingsData | null,
  generateRankingsPDF: vi.fn(),
}));

vi.mock("@/hooks/use-swim-records", () => ({
  useSwimRecords: () => ({ records: [], isLoading: false, error: undefined, mutate: vi.fn() }),
}));
vi.mock("@/lib/rankingCalculations", () => ({
  getLatestEvenMonth: () => ({ year: 2026, month: 8 }),
  calculateIMRankings: () => state.imRankings,
  calculateGrowthRankings: () => state.growthRankings,
}));
vi.mock("@/lib/pdfGenerator", () => ({
  generateRankingsPDF: state.generateRankingsPDF,
  pdfDateStamp: () => "2026-09-11",
}));
vi.mock("wouter", () => ({ useLocation: () => ["/rankings", vi.fn()] }));

const imRecord = {
  rank: 1,
  athleteName: "山田太郎",
  time: "1:23.45",
  date: new Date("2026-08-10"),
};

const growthRecord = {
  rank: 1,
  athleteName: "山田太郎",
  studentId: 1,
  bestTime: "1:30.00",
  currentTime: "1:23.45",
  growthRate: 7.28,
  improvementSeconds: 6.55,
  bestDate: new Date("2026-06-10"),
  currentDate: new Date("2026-08-10"),
};

const growthData = {
  periods: {
    current: { year: 2026, month: 8 },
    previous: { year: 2026, month: 6 },
  },
  rankings: {
    "60m": { male: [growthRecord], female: [] },
    "120m": { male: [], female: [] },
  },
};

describe("ranking PDF controls", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    state.imRankings = {
      "60m": { male: [imRecord], female: [] },
      "120m": { male: [], female: [] },
    };
    state.growthRankings = growthData;
    state.generateRankingsPDF.mockResolvedValue(undefined);
  });

  it("passes calculated IM rankings and the JST filename to the PDF generator", async () => {
    render(<IMRankings />);

    fireEvent.click(screen.getAllByRole("button", { name: "PDF出力" })[0]);

    await waitFor(() => expect(state.generateRankingsPDF).toHaveBeenCalledTimes(1));
    expect(state.generateRankingsPDF).toHaveBeenCalledWith(
      { kind: "measurement", rankings: state.imRankings, monthLabel: "2026年8月" },
      "IM測定ランキング_2026年8月_2026-09-11.pdf",
    );
  });

  it("prevents duplicate IM PDF generation while the first request is pending", async () => {
    let resolve!: () => void;
    state.generateRankingsPDF.mockImplementation(() => new Promise<void>((r) => { resolve = r; }));
    render(<IMRankings />);
    const buttons = screen.getAllByRole("button", { name: "PDF出力" });

    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);

    expect(state.generateRankingsPDF).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button", { name: "PDF作成中..." })).toHaveLength(2);
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
    resolve();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "PDF出力" })).toHaveLength(2));
  });

  it("re-enables Growth PDF buttons and reports the error after a failed request", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    state.generateRankingsPDF.mockRejectedValue(new Error("render failed"));
    render(<GrowthRankings />);
    fireEvent.click(screen.getAllByRole("button", { name: "PDF出力" })[0]);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      "PDFの生成中にエラーが発生しました。もう一度お試しください。",
    ));
    expect(screen.getAllByRole("button", { name: "PDF出力" }).every((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
    alertSpy.mockRestore();
  });

  it("disables both IM and Growth PDF buttons when all ranking groups are empty", () => {
    state.imRankings = {
      "60m": { male: [], female: [] },
      "120m": { male: [], female: [] },
    };
    state.growthRankings = {
      ...growthData,
      rankings: {
        "60m": { male: [], female: [] },
        "120m": { male: [], female: [] },
      },
    };

    const imView = render(<IMRankings />);
    expect(screen.getAllByRole("button", { name: "PDF出力" }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    imView.unmount();
    render(<GrowthRankings />);
    expect(screen.getAllByRole("button", { name: "PDF出力" }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it("passes calculated Growth rankings and the current period label", async () => {
    render(<GrowthRankings />);
    fireEvent.click(screen.getAllByRole("button", { name: "PDF出力" })[0]);

    await waitFor(() => expect(state.generateRankingsPDF).toHaveBeenCalledWith(
      { kind: "growth", rankings: growthData, monthLabel: "2026年8月" },
      "IM伸び率ランキング_2026年8月_2026-09-11.pdf",
    ));
  });
});
