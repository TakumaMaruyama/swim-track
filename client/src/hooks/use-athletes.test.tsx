// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAthletes } from "./use-athletes";

const athletes = [
  { id: 2, username: "山田 太郎", nameKana: "やまだ たろう" },
  { id: 1, username: "阿部 次郎", nameKana: "あべ じろう" },
];

vi.mock("swr", () => ({
  default: () => ({ data: athletes, error: undefined, mutate: vi.fn() }),
}));

describe("useAthletes nameKana regression", () => {
  it("sorts by nameKana without changing the displayed full name or athlete ID", () => {
    const { result } = renderHook(() => useAthletes());

    expect(result.current.athletes).toEqual([
      { id: 1, username: "阿部 次郎", nameKana: "あべ じろう" },
      { id: 2, username: "山田 太郎", nameKana: "やまだ たろう" },
    ]);
  });
});