import { and, eq } from "drizzle-orm";
import { db, pool } from "../db";
import { users } from "../db/schema";
import { normalizeFullName } from "../server/fullName";
import { UNUSABLE_PASSWORD_HASH } from "../server/passwordPolicy";

async function createStudent() {
  const username = process.env.ATHLETE_FULL_NAME?.trim();
  const loginKey = normalizeFullName(username ?? "");
  if (!username || !loginKey) throw new Error("ATHLETE_FULL_NAME が必要です");
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "student"), eq(users.loginKey, loginKey)))
    .limit(1);
  if (existingUser) throw new Error("同じ選手名が既に登録されています");
  const [student] = await db
    .insert(users)
    .values({
      username,
      loginKey,
      password: UNUSABLE_PASSWORD_HASH,
      credentialState: "setup_required",
      authVersion: 1,
      role: "student",
      isActive: true,
      gender: process.env.ATHLETE_GENDER === "female" ? "female" : "male",
    })
    .returning({ id: users.id, username: users.username });
  console.log("Athlete created", { id: student.id, username: student.username });
}

createStudent()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Failed to create athlete");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
