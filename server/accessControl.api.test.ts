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

await database.pool.exec(`
  CREATE SEQUENCE test_record_ids START 1000;
  ALTER TABLE swim_records ALTER COLUMN id SET DEFAULT nextval('test_record_ids');
  ALTER TABLE users ADD COLUMN password_set_by integer REFERENCES users(id);
`);

beforeEach(async () => {
  await database.reset();
  await database.pool.exec("UPDATE users SET is_active = true WHERE id = 2");
});
afterAll(() => database.pool.close());

async function viewer(role: "student" | "admin", password = "test-password") {
  const store = new session.MemoryStore();
  const agent = request.agent(createApp({ sessionStore: store }));
  const response = role === "admin"
    ? await agent.post("/api/auth/login").send({ username: "admin", password })
    : await agent.post("/api/auth/athlete/login").send({ fullName: "有効選手", password });
  expect(response.status).toBe(200);
  return { agent, store, response };
}

const recordInput = {
  studentId: 2, gender: "female", style: "自由形", distance: 50,
  time: "00:33.00", date: "2026-10-06", poolLength: 25,
};

describe("member access boundaries with an isolated PostgreSQL database", () => {
  it("allows own record edits but cannot create, transfer, edit or delete records for another member", async () => {
    const { agent } = await viewer("student");
    const created = await agent.post("/api/records").send(recordInput);
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ studentId: 1, gender: "male" });

    expect((await agent.put("/api/records/22").send(recordInput)).status).toBe(404);
    expect((await agent.delete("/api/records/22")).status).toBe(404);
    const other = await database.pool.query("SELECT student_id, time FROM swim_records WHERE id = 22");
    expect(other.rows).toEqual([{ student_id: 2, time: "00:25.00" }]);

    const own = await agent.put("/api/records/11").send(recordInput);
    expect(own.status).toBe(200);
    expect(own.body).toMatchObject({ studentId: 1, time: "00:33.00" });
    expect((await agent.delete("/api/records/11")).status).toBe(200);
    expect((await database.pool.query("SELECT id FROM swim_records WHERE id = 11")).rows).toEqual([]);
  });

  it("rejects member access to account administration and password-management data", async () => {
    const { agent } = await viewer("student");
    expect((await agent.get("/api/users/passwords")).status).toBe(403);
    for (const [method, path] of [
      ["post", "/api/athletes"], ["put", "/api/athletes/2"],
      ["patch", "/api/athletes/2/status"], ["delete", "/api/athletes/2"],
      ["put", "/api/admin/athletes/2/temporary-password"], ["put", "/api/users/2/password"],
      ["post", "/api/competitions"], ["put", "/api/competitions/1"],
      ["post", "/api/admin/announcements"],
    ] as const) {
      const response = await agent[method](path).send({ password: "different-password", isActive: false });
      expect(response.status, `${method} ${path}`).toBe(403);
    }
    expect((await database.pool.query("SELECT is_active, auth_version FROM users WHERE id = 2")).rows)
      .toEqual([{ is_active: true, auth_version: 1 }]);
  });

  it.each(["is_active = false", "auth_version = 2", "role = 'admin'"])(
    "revokes an existing member cookie after %s and blocks writes", async (change) => {
      const { agent } = await viewer("student");
      await database.pool.exec(`UPDATE users SET ${change} WHERE id = 1`);
      expect((await agent.get("/api/auth/session")).status).toBe(401);
      expect((await agent.put("/api/records/11").send(recordInput)).status).toBe(401);
      expect((await database.pool.query("SELECT time FROM swim_records WHERE id = 11")).rows)
        .toEqual([{ time: "00:40.00" }]);
    },
  );

  it("invalidates the old session on password reset and binds the temporary-password change to its owner", async () => {
    const { agent: old } = await viewer("student");
    const { agent: admin } = await viewer("admin");
    expect((await admin.put("/api/admin/athletes/1/temporary-password")
      .send({ password: "temporary-password" })).status).toBe(200);
    expect((await old.get("/api/auth/session")).status).toBe(401);

    const { agent, response } = await viewer("student", "temporary-password");
    expect(response.body.mustChangePassword).toBe(true);
    expect((await agent.post("/api/records").send(recordInput)).status).toBe(403);
    const changed = await agent.post("/api/auth/athlete/password").send({
      userId: 2, fullName: "無効選手", password: "new-password", passwordConfirmation: "new-password",
    });
    expect(changed.status).toBe(200);
    expect(changed.body.user).toMatchObject({ id: 1, credentialState: "active" });
    expect((await agent.post("/api/records").send(recordInput)).status).toBe(200);
    expect((await database.pool.query("SELECT auth_version, password_set_by FROM users WHERE id = 2")).rows)
      .toEqual([{ auth_version: 1, password_set_by: null }]);
  });

  it("rejects a cookie after its session expires", async () => {
    const { agent, store } = await viewer("student");
    await new Promise<void>((resolve, reject) => store.clear(error => error ? reject(error) : resolve()));
    expect((await agent.get("/api/auth/session")).status).toBe(401);
    expect((await agent.delete("/api/records/11")).status).toBe(401);
  });

  it("keeps authenticated responses non-cacheable and never returns credential fields in public data", async () => {
    const { agent } = await viewer("admin");
    for (const path of ["/API/auth/session", "/Api/athletes", "/API/records", "/API/users/passwords"]) {
      const response = await agent.get(path);
      expect(response.status, path).toBe(200);
      expect(response.headers["cache-control"], path).toContain("no-store");
      for (const forbidden of ["password", "loginKey", "authVersion", "passwordSetBy"]) {
        expect(response.text, path).not.toContain(`"${forbidden}":`);
      }
    }
  });
});
