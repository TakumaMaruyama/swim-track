// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Athletes from "./Athletes";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: undefined,
    isAdmin: false,
    isAuthenticated: false,
    logout: vi.fn(),
  }),
}));
vi.mock("../hooks/use-athletes", () => ({
  useAthletes: () => ({
    athletes: [{ id: 31, username: "山田 太郎", nameKana: "やまだ たろう", isActive: true }],
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  }),
}));
vi.mock("../hooks/use-swim-records", () => ({
  useSwimRecords: () => ({ records: [], isLoading: false, error: undefined, mutate: vi.fn() }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/athletes", vi.fn()] }));

describe("Athletes public access", () => {
  it("shows athlete read content and login affordance without anonymous write controls", () => {
    render(<Athletes />);

    expect(screen.getByText("山田 太郎")).toBeTruthy();
    expect(screen.getByRole("button", { name: "ログイン" })).toBeTruthy();
    expect(screen.queryByText("大会目標一覧を見る")).toBeNull();
    expect(screen.queryByRole("button", { name: "選手追加" })).toBeNull();
    expect(screen.queryByRole("button", { name: "ログアウト" })).toBeNull();
    expect(screen.queryByRole("button", { name: "記録追加" })).toBeNull();
  });
});
