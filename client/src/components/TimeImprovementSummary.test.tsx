// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TimeImprovementSummary } from "./TimeImprovementSummary";

const swrState = vi.hoisted(() => ({
  keys: [] as Array<string | null>,
  data: {
    athleteId: 31,
    months: 6,
    items: [
      {
        eventLabel: "50m自由形 (25m)",
        startBestTime: "00:31.23",
        currentBestTime: "00:30.99",
        improvementMs: 240,
        improvementRate: 0.768,
        status: "improved" as const,
      },
      {
        eventLabel: "100m背泳ぎ (25m)",
        startBestTime: "01:02.96",
        currentBestTime: "01:02.96",
        improvementMs: 0,
        improvementRate: 0,
        status: "flat" as const,
      },
    ],
  },
}));

vi.mock("swr", () => ({
  default: (key: string | null) => {
    swrState.keys.push(key);
    return {
      data: key ? swrState.data : undefined,
      error: undefined,
      isLoading: false,
    };
  },
}));

describe("TimeImprovementSummary", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    swrState.keys = [];
  });

  it("keeps the comparison out of the way until the athlete opens it", () => {
    render(<TimeImprovementSummary athleteId={31} isActive />);

    const trigger = screen.getByRole("button", { name: "タイムの変化を見る" });
    const panel = trigger.closest("section");
    expect(trigger.className).toContain("text-blue-700");
    expect(trigger.className).toContain("h-12");
    expect(panel?.className).toContain("bg-blue-50/70");
    expect(panel?.className).toContain("min-h-12");
    expect(panel?.className).not.toContain("overflow-hidden");
    expect(screen.queryByText("自己ベストの変化")).toBeNull();
    expect(swrState.keys.at(-1)).toBeNull();
  });

  it("explains the comparison and shows every event with readable values", () => {
    render(<TimeImprovementSummary athleteId={31} isActive />);

    fireEvent.click(screen.getByRole("button", { name: "タイムの変化を見る" }));

    expect(screen.getByText("選んだ期間より前の自己ベストと、現在までの自己ベストを比べています。")).toBeTruthy();
    expect(screen.getByText("50m自由形 (25m)")).toBeTruthy();
    expect(screen.getByText("00:31.23 → 00:30.99")).toBeTruthy();
    expect(screen.getByText("0.24秒短縮（0.8%）")).toBeTruthy();
    expect(screen.getByText("100m背泳ぎ (25m)")).toBeTruthy();
    expect(screen.getByText("変化なし（0.0%）")).toBeTruthy();
  });

  it("loads only the period selected inside the comparison panel", () => {
    render(<TimeImprovementSummary athleteId={31} isActive />);

    fireEvent.click(screen.getByRole("button", { name: "タイムの変化を見る" }));
    expect(swrState.keys.at(-1)).toContain("months=6");

    fireEvent.change(screen.getByLabelText("比較期間"), { target: { value: "3" } });
    expect(swrState.keys.at(-1)).toContain("months=3");
  });

  it("closes again when the record-history dialog is reopened", () => {
    const view = render(<TimeImprovementSummary athleteId={31} isActive />);

    fireEvent.click(screen.getByRole("button", { name: "タイムの変化を見る" }));
    expect(screen.getByText("自己ベストの変化")).toBeTruthy();

    view.rerender(<TimeImprovementSummary athleteId={31} isActive={false} />);
    view.rerender(<TimeImprovementSummary athleteId={31} isActive />);

    expect(screen.getByRole("button", { name: "タイムの変化を見る" })).toBeTruthy();
    expect(screen.queryByText("自己ベストの変化")).toBeNull();
  });
});
