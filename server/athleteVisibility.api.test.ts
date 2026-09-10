import session from "express-session";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
  const { createVisibilityDatabase } = await import("./test/visibilityDatabase");
  return createVisibilityDatabase();
});
vi.mock("./config", () => ({ default: {
  databaseUrl: "postgres://unused-test-only", sessionSecret: "test-secret", nodeEnv: "test", publicOrigin: "",
} }));

const database = await import("db") as unknown as Awaited<
  ReturnType<typeof import("./test/visibilityDatabase").createVisibilityDatabase>
>;
const { createApp } = await import("./app");

beforeEach(() => database.reset());
afterAll(() => database.pool.close());

async function viewer(role: "guest" | "student" | "admin") {
  const app = createApp({ sessionStore: new session.MemoryStore() });
  const agent = request.agent(app);
  if (role !== "guest") {
    const response = role === "admin"
      ? await agent.post("/api/auth/login").send({ username: "admin", password: "test-password" })
      : await agent.post("/api/auth/athlete/login").send({ fullName: "有効選手", password: "test-password" });
    expect(response.status).toBe(200);
  }
  return agent;
}

describe.each(["guest", "student", "admin"] as const)("athlete visibility for %s", (role) => {
  it("preserves inactive athletes' all-time bests without exposing their other records", async () => {
    const agent = await viewer(role);
    const response = await agent.get("/api/records/all-time");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ id: 26, studentId: 2, athleteName: "無効選手", time: "00:21.00" });
    expect(Object.keys(response.body[0]).sort()).toEqual([
      "athleteName", "date", "distance", "gender", "id", "poolLength", "studentId", "style", "time",
    ]);
    const ordinary = await agent.get("/api/records");
    expect(ordinary.text.includes("無効選手")).toBe(role === "admin");
  });

  it("filters athletes, records, recent activity and CSV while preserving admin access", async () => {
    const agent = await viewer(role);
    const isAdmin = role === "admin";
    const athletes = await agent.get("/api/athletes");
    expect(athletes.status).toBe(200);
    expect(athletes.body.map((athlete: { id: number }) => athlete.id).sort()).toEqual(isAdmin ? [1, 2] : [1]);
    expect(athletes.body[0]).not.toHaveProperty("password");
    for (const path of ["/api/records", "/api/recent-activities", "/api/records/download"]) {
      const response = await agent.get(path);
      expect(response.status, path).toBe(200);
      expect(response.headers["cache-control"]).toContain("no-store");
      expect(response.text.includes("無効選手"), path).toBe(isAdmin);
      if (!isAdmin) {
        expect(response.text, path).toContain("有効選手");
        if (path !== "/api/records/download") {
          expect(response.body.map((record: { id: number }) => record.id).sort()).toEqual([11, 12]);
        }
      }
    }
  });

  it("applies the same visibility to the legacy athlete schema", async () => {
    await database.pool.exec("ALTER TABLE users DROP COLUMN birth_date");
    const response = await (await viewer(role)).get("/api/athletes");
    expect(response.status).toBe(200);
    expect(response.body.map((athlete: { id: number }) => athlete.id).sort()).toEqual(role === "admin" ? [1, 2] : [1]);
    expect(response.body.every((athlete: { birthDate: unknown }) => athlete.birthDate === null)).toBe(true);
  });

  it("protects direct summaries and keeps visible athlete summaries working", async () => {
    const agent = await viewer(role);
    const active = await agent.get("/api/athletes/1/improvement-summary?months=1");
    expect(active.status).toBe(200);
    expect(active.body.items).toHaveLength(1);
    const inactive = await agent.get("/api/athletes/2/improvement-summary?months=1");
    expect(inactive.status).toBe(role === "admin" ? 200 : 404);
    if (role === "admin") expect(inactive.body.items).toHaveLength(1);
    else expect(inactive.body).not.toHaveProperty("items");
    expect((await agent.get("/api/athletes/999/improvement-summary?months=1")).status).toBe(404);
  });

  it("counts only visible records without dropping empty competitions", async () => {
    const response = await (await viewer(role)).get("/api/competitions");
    expect(response.status).toBe(200);
    expect(response.body.map((competition: { recordCount: number }) => competition.recordCount))
      .toEqual(role === "admin" ? [4, 5, 0] : [2, 0, 0]);
  });
});

it("keeps all-time start dates, event groups and the most recent tied best", async () => {
  await database.pool.exec(`
    UPDATE users SET all_time_start_date = (SELECT date FROM swim_records WHERE id = 24) WHERE id = 2;
    INSERT INTO swim_records (id, student_id, style, distance, time, date, pool_length) VALUES
      (40, 1, '自由形', 50, '00:23.00', now(), 25),
      (41, 2, '背泳ぎ', 50, '00:30.00', now(), 25),
      (42, 2, '自由形', 100, '01:00.00', now(), 25),
      (43, 2, '自由形', 50, '00:20.00', now(), 50);
  `);
  const response = await (await viewer("guest")).get("/api/records/all-time");
  expect(response.status).toBe(200);
  expect(response.body.map((record: { id: number }) => record.id).sort()).toEqual([40, 41, 42, 43]);
  await database.pool.exec("UPDATE users SET gender = 'female' WHERE id = 2");
  const genders = await (await viewer("guest")).get("/api/records/all-time");
  expect(genders.body.map((record: { id: number }) => record.id).sort()).toEqual([24, 40, 41, 42, 43]);
});

it("compares all-time times numerically across supported minute and decimal formats", async () => {
  await database.pool.exec(`
    UPDATE swim_records SET time = '0:19.5' WHERE id = 12;
    UPDATE swim_records SET time = '00:19.500' WHERE id = 26;
  `);
  const response = await (await viewer("guest")).get("/api/records/all-time");
  expect(response.status).toBe(200);
  expect(response.body.map((record: { id: number }) => record.id)).toEqual([26]);
  await database.pool.exec("UPDATE swim_records SET time = '0:19.49' WHERE id = 12");
  const faster = await (await viewer("guest")).get("/api/records/all-time");
  expect(faster.body.map((record: { id: number }) => record.id)).toEqual([12]);
});

it.each(["is_active = false", "role = 'student'", "auth_version = 2"])(
  "drops admin visibility when the current session is revoked: %s", async (change) => {
    const agent = await viewer("admin");
    await database.pool.exec(`UPDATE users SET ${change} WHERE id = 7`);
    const response = await agent.get("/api/athletes");
    expect(response.status).toBe(200);
    expect(response.body.map((athlete: { id: number }) => athlete.id).sort())
      .toEqual(change === "role = 'student'" ? [1, 7] : [1]);
    expect((await agent.get("/api/records")).text).not.toContain("無効選手");
  },
);

it("updates visibility on disable and restore without deleting records", async () => {
  const admin = await viewer("admin");
  const guest = await viewer("guest");
  expect((await admin.patch("/api/athletes/1/status").send({ isActive: false })).status).toBe(200);
  expect((await guest.get("/api/athletes")).body).toEqual([]);
  expect((await guest.get("/api/records")).body).toEqual([]);
  expect((await admin.get("/api/records")).body).toHaveLength(8);
  expect((await admin.patch("/api/athletes/1/status").send({ isActive: true })).status).toBe(200);
  expect((await guest.get("/api/records")).body).toHaveLength(2);
});
