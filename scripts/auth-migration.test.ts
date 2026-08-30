import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ pool: {} }));

import {
  APPLY_SQL,
  LOGIN_KEY_INDEX_SQL,
  PASSWORD_SENTINEL,
  findNormalizedNameCollision,
} from "./auth-migration";

describe("auth migration safety contracts", () => {
  it("rejects empty and Unicode-whitespace normalized names", () => {
    expect(findNormalizedNameCollision(["山田　太郎", "山田 太郎"])).toBe("山田太郎");
    expect(findNormalizedNameCollision(["　"])).toBe("<empty>");
    expect(findNormalizedNameCollision(["山田太郎", "別の選手"])).toBeNull();
  });

  it("uses an unusable bcrypt-shaped password sentinel", () => {
    expect(PASSWORD_SENTINEL).toMatch(/^\$2b\$10\$.{53}$/);
    expect(PASSWORD_SENTINEL).toHaveLength(60);
  });

  it("contains only the confirmed auth/session schema changes", () => {
    expect(APPLY_SQL).toContain("credential_state");
    expect(APPLY_SQL).toContain("auth_version");
    expect(APPLY_SQL).toContain("swimtrack_sessions");
    expect(APPLY_SQL).toContain("swimtrack_auth_attempts");
    expect(APPLY_SQL).not.toContain("auth_state");
    expect(APPLY_SQL).not.toContain("session_version");
    expect(APPLY_SQL).not.toContain("birth_date");
    expect(APPLY_SQL).not.toContain("qualification");
    expect(LOGIN_KEY_INDEX_SQL).toContain("role = 'student'");
    expect(LOGIN_KEY_INDEX_SQL).toContain("login_key IS NOT NULL");
  });
});
