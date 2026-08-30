// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimeHistoryModal } from "./TimeHistoryModal";

describe("TimeHistoryModal", () => {
  afterEach(() => cleanup());

  it("uses normal document flow so an expanded comparison panel keeps its height", () => {
    render(
      <TimeHistoryModal
        isOpen
        onClose={vi.fn()}
        athleteId={31}
        records={[]}
        athleteName="山田太郎"
        canManageRecords={false}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "山田太郎の記録履歴" });
    const displayClasses = dialog.className.split(/\s+/);

    expect(displayClasses).toContain("block");
    expect(displayClasses).not.toContain("grid");
  });
});
