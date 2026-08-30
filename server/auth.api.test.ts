import expressSession from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  selected: [] as unknown[][],
  returned: [] as unknown[][],
  values: [] as unknown[],
  updates: 0,
}));

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
    where: () => mutationChain,
    returning: () => Promise.resolve(state.returned.shift() ?? []),
  };
  return {
    db: {
      select: () => selectChain,
      update: () => {
        state.updates += 1;
        return mutationChain;
      },
      insert: () => mutationChain,
      delete: () => mutationChain,
    },
    pool: {},
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

vi.mock("./config", () => ({
  default: {
    databaseUrl: "postgres://test",
    sessionSecret: "test-session-secret",
    nodeEnv: "test",
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(async (password: string) => password === "correct-password"),
    hash: vi.fn(async () => "bcrypt-hash"),
  },
}));

vi.mock("connect-pg-simple", () => ({
  default: () => class {},
}));

const student = (overrides = {}) => ({
  id: 1,
  username: "山田太郎",
  loginKey: "山田太郎",
  password: "hash",
  role: "student",
  isActive: true,
  authState: "active",
  sessionVersion: 1,
  ...overrides,
});

async function makeApp() {
  const { createApp } = await import("./app");
  return createApp({ sessionStore: new expressSession.MemoryStore() });
}

describe("auth API and ownership policy", () => {
  beforeEach(() => {
    state.selected = [];
    state.returned = [];
    state.values = [];
    state.updates = 0;
    vi.clearAllMocks();
  });

  it("uses the same generic failure for missing users and invalid passwords", async () => {
    const app = await makeApp();
    state.selected.push([], [student()]);
    const missing = await request(app).post("/api/auth/login").send({ fullName: "不明", password: "x" });
    const invalid = await request(app).post("/api/auth/login").send({ fullName: "山田 太郎", password: "wrong" });
    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(missing.body.message).toBe("認証に失敗しました");
    expect(invalid.body.message).toBe(missing.body.message);
  });

  it("completes initial setup only after identity verification", async () => {
    const app = await makeApp();
    const agent = request.agent(app);
    state.selected.push([student({ authState: "initial_setup" })]);
    const identified = await agent.post("/api/auth/identify").send({ fullName: "山田　太郎" });
    expect(identified.body.requiresPasswordSetup).toBe(true);
    state.returned.push([student({ authState: "active", sessionVersion: 2 })]);
    const setup = await agent.post("/api/auth/setup-password").send({
      fullName: "ignored-by-server",
      password: "new-password",
      passwordConfirmation: "new-password",
    });
    expect(setup.status).toBe(200);
    expect(setup.body.user.authState).toBe("active");
    expect(state.values[0]).toMatchObject({ authState: "active", sessionVersion: 2 });
  });

  it("forces temporary-password sessions through the change path while preserving public reads", async () => {
    const app = await makeApp();
    const agent = request.agent(app);
    const temporary = student({ authState: "temp_password" });
    state.selected.push([temporary]);
    state.returned.push([temporary]);
    const login = await agent.post("/api/auth/login").send({ fullName: "山田太郎", password: "correct-password" });
    expect(login.body.mustChangePassword).toBe(true);
    const sessionCookie = login.headers["set-cookie"]?.[0] ?? "";
    expect(sessionCookie).toContain("swimtrack.sid=");
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");
    expect(sessionCookie).not.toContain("Domain=");

    state.selected.push([]);
    expect((await agent.get("/api/records")).status).toBe(200);

    // Auth temporary-session gate and change handler each DB-revalidate.
    state.selected.push([temporary], [temporary]);
    state.returned.push([student({ authState: "active", sessionVersion: 2 })]);
    expect((await agent.post("/api/auth/change-password").send({
      password: "new-password", passwordConfirmation: "new-password",
    })).status).toBe(200);

    // A version mismatch invalidates private session information.
    state.selected.push([student({ sessionVersion: 3 })]);
    expect((await agent.get("/api/auth/session")).status).toBe(401);
  });

  it("keeps public API reads available and forces a student's record owner on writes", async () => {
    const app = await makeApp();
    state.selected.push([]);
    expect((await request(app).get("/api/records")).status).toBe(200);
    expect((await request(app).post("/api/records").send({})).status).toBe(401);

    const agent = request.agent(app);
    state.selected.push([student()]);
    state.returned.push([student()]);
    await agent.post("/api/auth/login").send({ fullName: "山田太郎", password: "correct-password" });
    state.selected.push([student()]);
    state.returned.push([{ id: 10, studentId: 1 }]);
    const created = await agent.post("/api/records").send({
      style: "free", distance: 50, time: "00:30.00", date: "2025-01-01",
      poolLength: 25, studentId: 999, gender: "male",
    });
    expect(created.status).toBe(200);
    expect(state.values.at(-1)).toMatchObject({ studentId: 1 });
  });

  it("rejects cross-owner record update and delete attempts", async () => {
    const app = await makeApp();
    const agent = request.agent(app);
    state.selected.push([student()]);
    state.returned.push([student()]);
    await agent.post("/api/auth/login").send({ fullName: "山田太郎", password: "correct-password" });

    state.selected.push([student()], [{ id: 9, studentId: 2 }]);
    const update = await agent.put("/api/records/9").send({
      style: "free", distance: 50, time: "00:30.00", date: "2025-01-01", poolLength: 25,
    });
    expect(update.status).toBe(403);

    state.selected.push([student()], [{ id: 9, studentId: 2 }]);
    const deletion = await agent.delete("/api/records/9");
    expect(deletion.status).toBe(403);
  });

  it("keeps admin record management compatible", async () => {
    const app = await makeApp();
    const agent = request.agent(app);
    const admin = student({ id: 7, username: "admin", role: "admin" });
    state.selected.push([], [admin]);
    state.returned.push([admin]);
    expect((await agent.post("/api/auth/login").send({ username: "admin", password: "correct-password" })).status).toBe(200);
    state.selected.push([admin]);
    state.returned.push([{ id: 11, studentId: 2 }]);
    expect((await agent.post("/api/records").send({
      style: "free", distance: 50, time: "00:30.00", date: "2025-01-01",
      poolLength: 25, studentId: 2, gender: "male",
    })).status).toBe(200);
    expect(state.values.at(-1)).toMatchObject({ studentId: 2 });
  });

  it("rejects a whitespace-equivalent athlete name before creating it", async () => {
    const app = await makeApp();
    const agent = request.agent(app);
    const admin = student({ id: 7, username: "admin", role: "admin", loginKey: null });
    state.selected.push([], [admin]);
    state.returned.push([admin]);
    await agent.post("/api/auth/login").send({ username: "admin", password: "correct-password" });
    // Write middleware revalidation followed by normalized-name duplicate lookup.
    state.selected.push([admin], [{ id: 2 }]);
    const response = await agent.post("/api/athletes").send({ username: "山田　太郎" });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("この選手名は既に使用されています");
    expect(state.values).toHaveLength(1); // only the login timestamp update
  });

  it("rejects a whitespace-equivalent athlete name on rename", async () => {
    const app = await makeApp();
    const agent = request.agent(app);
    const admin = student({ id: 7, username: "admin", role: "admin", loginKey: null });
    state.selected.push([], [admin]);
    state.returned.push([admin]);
    await agent.post("/api/auth/login").send({ username: "admin", password: "correct-password" });
    // Revalidation, current athlete lookup, then normalized-name duplicate lookup.
    state.selected.push([admin], [student({ id: 3, username: "別の選手" })], [{ id: 2 }]);
    const response = await agent.put("/api/athletes/3").send({ username: "山田 太郎" });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("このユーザー名は既に使用されています");
    expect(state.values).toHaveLength(1);
  });
});