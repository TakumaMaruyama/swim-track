// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { expect, it, vi } from "vitest";
import RecordsAll from "./RecordsAll";

vi.mock("@/components/PageHeader", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));

it("shows retained all-time records from their dedicated API and supports gender/course filters", async () => {
  const fetcher = vi.fn(async (url: string) => {
    if (url !== "/api/records/all-time") return [];
    return [
      { id: 26, studentId: 2, athleteName: "無効選手", style: "自由形", distance: 50, poolLength: 25, gender: "male", time: "00:21.00", date: "2026-09-06" },
      { id: 27, studentId: 2, athleteName: "無効選手", style: "自由形", distance: 50, poolLength: 50, gender: "male", time: "00:24.00", date: "2026-09-06" },
      { id: 30, studentId: 3, athleteName: "女子選手", style: "自由形", distance: 50, poolLength: 25, gender: "female", time: "00:26.00", date: "2026-09-06" },
    ];
  });
  render(<SWRConfig value={{ provider: () => new Map(), fetcher }}><RecordsAll /></SWRConfig>);
  expect(await screen.findByText("無効選手")).toBeTruthy();
  expect(screen.getByText("00'21.00\"")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "50m（長水路）" }));
  expect(screen.getByText("00'24.00\"")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "25m（短水路）" }));
  fireEvent.click(screen.getByRole("button", { name: "女子" }));
  expect(screen.getByText("女子選手")).toBeTruthy();
  expect(screen.queryByText("無効選手")).toBeNull();
  expect(fetcher.mock.calls.every(([url]) => url === "/api/records/all-time")).toBe(true);
});
