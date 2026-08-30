import { describe, expect, it } from "vitest";
import { normalizeFullName } from "./fullName";

describe("normalizeFullName", () => {
  it("removes ASCII, full-width, and Unicode whitespace without folding characters", () => {
    expect(normalizeFullName("山田 太郎")).toBe("山田太郎");
    expect(normalizeFullName("山田　太郎")).toBe("山田太郎");
    expect(normalizeFullName("山田\u00a0太郎\u200b")).toBe("山田太郎");
    expect(normalizeFullName("Ａ B")).toBe("ＡB");
  });
});