import expressSession from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  selected: [] as unknown[][],
  selections: [] as unknown[],
  returned: [] as unknown[][],
  returningSelections: [] as unknown[],
  values: [] as unknown[],
  mutationWheres: [] as unknown[],
}));
const configState = vi.hoisted(() => ({
  databaseUrl: "postgres://test",
  sessionSecret: "test-session-secret",
  nodeEnv: "test",
  publicOrigin: "",
}));
const poolQuery = vi.hoisted(() => vi.fn(async (_sql: string, params?: unknown[]) => ({
  rows: [
    { key_hash: params?.[0], attempt_count: 1 },
    { key_hash: params?.[1], attempt_count: 1 },
  ],
})));

vi.mock("db", () => {
  const selectChain = {
    from: () => selectChain,
    where: () => selectChain,
    leftJoin: () => selectChain,
    groupBy: () => selectChain,
    limit: () => Promise.resolve(state.selected.shift() ?? []),
    orderBy: () => Promise.resolve(state.selected.shift() ?? []),
    then: <TResult1 = unknown[], TResult2 = never>(
      onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(state.selected.shift() ?? []).then(onfulfilled, onrejected),
  };
  const mutationChain = {
    set: (value: unknown) => {
      state.values.push(value);
      return mutationChain;
    },
    values: (value: unknown) => {
      state.values.push(value);
      return mutationChain;
    },
    where: (value: unknown) => {
      state.mutationWheres.push(value);
      return mutationChain;
    },
    returning: (selection?: unknown) => {
      state.returningSelections.push(selection);
      return Promise.resolve(state.returned.shift() ?? []);
    },
  };
  return {
    db: {
      select: (selection?: unknown) => {
        state.selections.push(selection);
        return selectChain;
      },
      update: () => mutationChain,
      insert: () => mutationChain,
      delete: () => mutationChain,
    },
    pool: { query: poolQuery },
  };
});

vi.mock("db/schema", () => {
  const column = {};
  return {
    users: new Proxy({}, { get: () => column }),
    swimRecords: new Proxy({}, { get: () => column }),
    announcements: new Proxy({}, { get: () => column }),
    competitions: new Proxy({}, { get: () => column }),
  };
});

vi.mock("drizzle-orm", () => ({
  and: (...items: unknown[]) => items,
  asc: (item: unknown) => item,
  count: () => ({}),
  desc: (item: unknown) => item,
  eq: (...items: unknown[]) => items,
  sql: Object.assign((_: TemplateStringsArray) => ({}), { raw: () => ({}) }),
}));

vi.mock("./config", () => ({ default: configState }));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(async (password: string) =>
      ["correct-password", "temporary-password", "new-password"].includes(password)),
    hash: vi.fn(async () => "bcrypt-hash"),
  },
}));

vi.mock("connect-pg-simple", () => ({ default: () => class {} }));

const student = (overrides = {}) => ({
  id: 1,
  username: "山田太郎",
  loginKey: "山田太郎",
  password: "hash",
  role: "student",
  isActive: true,
  gender: "male",
  credentialState: "active",
  authVersion: 1,
  ...overrides,
});

const admin = (overrides = {}) => student({
  id: 7,
  username: "admin",
  loginKey: null,
  role: "admin",
  credentialState: "active",
  ...overrides,
});

async function makeApp() {
  const { createApp } = await import("./app");
  return createApp({ sessionStore: new expressSession.MemoryStore() });
}

describe("athlete authentication and authorization", () => {
  beforeEach(() => {
    state.selected = [];
    state.selections = [];
    state.returned = [];
    state.returningSelections = [];
    state.values = [];
    state.mutationWheres = [];
    configState.nodeEnv = "test";
    configState.publicOrigin = "";
    poolQuery.mockClear();
    vi.clearAllMocks();
  });

  it("keeps reads public, rejects anonymous writes, and rejects cross-origin writes", async () => {
    const app = await makeApp();
    state.selected.push([]);
    expect((await request(app).get("/api/records")).status).toBe(200);
    expect((await request(app).post("/api/records").send({})).status).toBe(401);
    expect((await request(app)
      .post("/api/auth/athlete/start")
      .set("Host", "swim-track.test")
      .set("Origin", "https://swim-platform.replit.app")
      .send({ fullName: "山田太郎" })).status).toBe(403);
    state.selected.push([]);
    expect((await request(app)
      .post("/api/auth/athlete/start")
      .set("Host", "swim-track.test")
      .set("Origin", "http://swim-track.test")
      .send({ fullName: "不明" })).status).toBe(401);
  });

  it("uses one generic failure for missing, inactive, and invalid-password athletes", async () => {
    const app = await makeApp();
    state.selected.push([], [student({ isActive: false })], [student()]);
    const missing = await request(app).post("/api/auth/athlete/login").send({ fullName: "不明", password: "x" });
    const inactive = await request(app).post("/api/auth/athlete/login").send({ fullName: "山田太郎", password: "correct-password" });
    const invalid = await request(app).post("/api/auth/athlete/login").send({ fullName: "山田太郎", password: "wrong" });
    expect([missing.status, inactive.status, invalid.status]).toEqual([401, 401, 401]);
    expect(missing.body.message).toBe("認証に失敗しました");
    expect(inactive.body.message).toBe(missing.body.message);
    expect(invalid.body.message).toBe(missing.body.message);
  });

  it("uses the shared PostgreSQL limiter without storing the full name", async () => {
    const app = await makeApp();
    poolQuery.mockResolvedValueOnce({
      rows: [
        { key_hash: "a".repeat(64), attempt_count: 101 },
        { key_hash: "b".repeat(64), attempt_count: 21 },
      ],
    });
    const response = await request(app)
      .post("/api/auth/athlete/login")
      .send({ fullName: "山田太郎", password: "wrong" });
    expect(response.status).toBe(429);
    const params = poolQuery.mock.calls[0]?.[1] as unknown[];
    expect(params[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(params[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(params)).not.toContain("山田太郎");
  });

  it("pins production writes and secure cookies to the SwimTrack origin", async () => {
    configState.nodeEnv = "production";
    configState.publicOrigin = "https://swim-track.replit.app";
    const app = await makeApp();

    expect((await request(app)
      .post("/api/auth/athlete/start")
      .set("Host", "swim-track.replit.app")
      .send({ fullName: "山田太郎" })).status).toBe(403);
    expect((await request(app)
      .post("/api/auth/athlete/start")
      .set("Host", "swim-track.replit.app")
      .set("Origin", "https://swim-platform.replit.app")
      .send({ fullName: "山田太郎" })).status).toBe(403);

    state.selected.push([student()]);
    const login = await request(app)
      .post("/api/auth/athlete/login")
      .set("Host", "swim-track.replit.app")
      .set("Origin", "https://swim-track.replit.app")
      .set("X-Forwarded-Proto", "https")
      .send({ fullName: "山田太郎", password: "correct-password" });
    expect(login.status).toBe(200);
    const cookie = login.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toContain("swimtrack.sid=");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("branches start into setup or login without exposing a password", async () => {
    const app = await makeApp();
    state.selected.push(
      [student({ credentialState: "setup_required" })],
      [student({ credentialState: "active" })],
    );
    const setup = await request(app).post("/api/auth/athlete/start").send({ fullName: "山田　太郎" });
    const login = await request(app).post("/api/auth/athlete/start").send({ fullName: "山田 太郎" });
    expect(setup.body).toMatchObject({ credentialState: "setup_required", requiresPasswordSetup: true });
    expect(login.body).toMatchObject({ credentialState: "active", requiresPasswordSetup: false });
    expect(JSON.stringify(setup.body)).not.toContain("password");
  });

  it("allows only the first concurrent initial-password setup", async () => {
    const app = await makeApp();
    const first = request.agent(app);
    const second = request.agent(app);
    const pending = student({ credentialState: "setup_required" });
    state.selected.push([pending], [pending]);
    expect((await first.post("/api/auth/athlete/start").send({ fullName: "山田太郎" })).status).toBe(200);
    expect((await second.post("/api/auth/athlete/start").send({ fullName: "山田太郎" })).status).toBe(200);
    state.returned.push([student({ credentialState: "active", authVersion: 2 })], []);
    const winner = await first.post("/api/auth/athlete/password").send({
      password: "new-password",
      passwordConfirmation: "new-password",
    });
    const loser = await second.post("/api/auth/athlete/password").send({
      password: "new-password",
      passwordConfirmation: "new-password",
    });
    expect(winner.status).toBe(200);
    expect(loser.status).toBe(401);
    expect(state.values[0]).toMatchObject({ credentialState: "active", authVersion: 2 });
    expect(state.returningSelections[0]).not.toHaveProperty("birthDate");
  });

  it("supports normal athlete login", async () => {
    const app = await makeApp();
    state.selected.push([student()]);
    const response = await request(app).post("/api/auth/athlete/login").send({
      fullName: "山田 太郎",
      password: "correct-password",
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ credentialState: "active", mustChangePassword: false });
    expect(response.body.user).not.toHaveProperty("loginKey");
    expect(response.body.user).not.toHaveProperty("authVersion");
    expect(response.body.user).not.toHaveProperty("passwordSetBy");
    expect(response.headers["set-cookie"]?.[0]).toContain("swimtrack.sid=");
  });

  it("keeps authentication queries independent of optional profile columns", async () => {
    const app = await makeApp();
    state.selected.push([admin()]);
    const response = await request(app).post("/api/auth/login").send({
      username: "admin",
      password: "correct-password",
    });

    expect(response.status).toBe(200);
    expect(Object.keys(state.selections[0] as Record<string, unknown>).sort()).toEqual([
      "authVersion",
      "credentialState",
      "gender",
      "id",
      "isActive",
      "password",
      "role",
      "username",
    ]);
    expect(state.selections[0]).not.toHaveProperty("birthDate");
  });

  it("invalidates an old session after admin reset and forces temporary password change", async () => {
    const app = await makeApp();
    const athleteAgent = request.agent(app);
    const adminAgent = request.agent(app);
    const active = student();
    const temporary = student({ credentialState: "temporary", authVersion: 2 });
    const changed = student({ credentialState: "active", authVersion: 3 });

    state.selected.push([active]);
    await athleteAgent.post("/api/auth/athlete/login").send({ fullName: "山田太郎", password: "correct-password" });
    state.selected.push([admin()]);
    await adminAgent.post("/api/auth/login").send({ username: "admin", password: "correct-password" });
    state.selected.push([admin()], [active]);
    state.returned.push([temporary]);
    const reset = await adminAgent
      .put("/api/admin/athletes/1/temporary-password")
      .send({ password: "temporary-password" });
    expect(reset.status).toBe(200);
    expect(reset.body.credentialState).toBe("temporary");

    state.selected.push([temporary]);
    expect((await athleteAgent.get("/api/auth/session")).status).toBe(401);

    const temporaryAgent = request.agent(app);
    state.selected.push([temporary]);
    const login = await temporaryAgent.post("/api/auth/athlete/login").send({
      fullName: "山田太郎",
      password: "temporary-password",
    });
    expect(login.body.mustChangePassword).toBe(true);
    state.selected.push([temporary], [temporary]);
    state.returned.push([changed]);
    expect((await temporaryAgent.post("/api/auth/athlete/password").send({
      password: "new-password",
      passwordConfirmation: "new-password",
    })).status).toBe(200);
    await temporaryAgent.post("/api/auth/logout");
    state.selected.push([changed]);
    expect((await temporaryAgent.post("/api/auth/athlete/login").send({
      fullName: "山田太郎",
      password: "new-password",
    })).status).toBe(200);
  });

  it("forces a student's record owner and gender from the session", async () => {
    const app = await makeApp();
    const agent = request.agent(app);
    state.selected.push([student({ gender: "female" })]);
    await agent.post("/api/auth/athlete/login").send({ fullName: "山田太郎", password: "correct-password" });
    state.selected.push([student({ gender: "female" })]);
    state.returned.push([{ id: 10, studentId: 1 }]);
    const created = await agent.post("/api/records").send({
      style: "free", distance: 50, time: "00:30.00", date: "2025-01-01",
      poolLength: 25, studentId: 999, gender: "male",
    });
    expect(created.status).toBe(200);
    expect(state.values.at(-1)).toMatchObject({ studentId: 1, gender: "female" });
  });

  it("returns the same 404 for another athlete's and a missing record", async () => {
    const app = await makeApp();
    const agent = request.agent(app);
    state.selected.push([student()]);
    await agent.post("/api/auth/athlete/login").send({ fullName: "山田太郎", password: "correct-password" });

    state.selected.push([student()]);
    state.returned.push([]);
    const update = await agent.put("/api/records/9").send({
      style: "free", distance: 50, time: "00:30.00", date: "2025-01-01", poolLength: 25,
    });
    state.selected.push([student()]);
    state.returned.push([]);
    const deletion = await agent.delete("/api/records/999");
    expect(update.status).toBe(404);
    expect(deletion.status).toBe(404);
    expect(update.body.message).toBe("記録が見つかりません");
    expect(deletion.body.message).toBe("記録が見つかりません");
    expect(JSON.stringify(state.mutationWheres)).toContain("9");
    expect(JSON.stringify(state.mutationWheres)).toContain("1");
  });

  it("keeps admin record management and validates the selected athlete", async () => {
    const app = await makeApp();
    const agent = request.agent(app);
    state.selected.push([admin()]);
    await agent.post("/api/auth/login").send({ username: "admin", password: "correct-password" });
    state.selected.push([admin()], [student({ id: 2 })]);
    state.returned.push([{ id: 11, studentId: 2 }]);
    const created = await agent.post("/api/records").send({
      style: "free", distance: 50, time: "00:30.00", date: "2025-01-01",
      poolLength: 25, studentId: 2, gender: "female",
    });
    expect(created.status).toBe(200);
    expect(state.values.at(-1)).toMatchObject({ studentId: 2, gender: "male" });
  });

  it("limits athlete management to admins and rejects normalized duplicate names", async () => {
    const app = await makeApp();
    const athleteAgent = request.agent(app);
    state.selected.push([student()]);
    await athleteAgent.post("/api/auth/athlete/login").send({ fullName: "山田太郎", password: "correct-password" });
    state.selected.push([student()]);
    expect((await athleteAgent.post("/api/athletes").send({ username: "新選手" })).status).toBe(403);

    const adminAgent = request.agent(app);
    state.selected.push([admin()]);
    await adminAgent.post("/api/auth/login").send({ username: "admin", password: "correct-password" });
    state.selected.push([admin()], [{ id: 2 }]);
    const duplicate = await adminAgent.post("/api/athletes").send({ username: "山田　太郎" });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.message).toBe("この選手名は既に使用されています");
  });

  it("invalidates an athlete session when an administrator changes the full name", async () => {
    const app = await makeApp();
    const athleteAgent = request.agent(app);
    const adminAgent = request.agent(app);
    state.selected.push([student()]);
    await athleteAgent.post("/api/auth/athlete/login").send({ fullName: "山田太郎", password: "correct-password" });
    state.selected.push([admin()]);
    await adminAgent.post("/api/auth/login").send({ username: "admin", password: "correct-password" });
    state.selected.push([admin()], [student()], []);
    state.returned.push([{ id: 1, username: "山田次郎" }]);
    expect((await adminAgent.put("/api/athletes/1").send({
      username: "山田次郎",
      gender: "male",
    })).status).toBe(200);
    expect(state.values.at(-1)).toHaveProperty("authVersion");
    state.selected.push([student({ username: "山田次郎", loginKey: "山田次郎", authVersion: 2 })]);
    expect((await athleteAgent.get("/api/auth/session")).status).toBe(401);
  });
});
