// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";

const navigate = vi.hoisted(() => vi.fn());

vi.mock("wouter", () => ({ useLocation: () => ["/", navigate] }));
vi.mock("@/hooks/use-mobile", () => ({ useMobile: () => false }));
vi.mock("@/components/AnnouncementCard", () => ({
  AnnouncementCard: () => <section>公開のお知らせ</section>,
}));

describe("Dashboard public access", () => {
  it("renders anonymous navigation and routes visitors to the public athletes page", () => {
    render(<Dashboard />);

    expect(screen.getByText("公開のお知らせ")).toBeTruthy();
    expect(screen.queryByText("大会目標一覧")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "選手一覧" }));
    expect(navigate).toHaveBeenCalledWith("/athletes");
  });
});
