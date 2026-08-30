import { describe, expect, it } from "vitest";
import {
  PASSWORD_MAX_BYTES,
  UNUSABLE_PASSWORD_HASH,
  validateNewPassword,
} from "./passwordPolicy";

describe("password policy", () => {
  it("counts Unicode code points for the six-character boundary", () => {
    expect(validateNewPassword("あいうえお", "あいうえお")).toBeTruthy();
    expect(validateNewPassword("あいうえおか", "あいうえおか")).toBeNull();
  });

  it("rejects bcrypt inputs above 72 UTF-8 bytes", () => {
    const tooLong = "あ".repeat(Math.floor(PASSWORD_MAX_BYTES / 3) + 1);
    expect(validateNewPassword(tooLong, tooLong)).toContain("72バイト");
  });

  it("requires confirmation and keeps a bcrypt-shaped setup sentinel", () => {
    expect(validateNewPassword("abcdef", "abcdeg")).toBeTruthy();
    expect(UNUSABLE_PASSWORD_HASH).toMatch(/^\$2b\$10\$.{53}$/);
  });
});
