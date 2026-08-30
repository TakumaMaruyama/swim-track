import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "../db";
import { users } from "../db/schema";
import { validateNewPassword } from "../server/passwordPolicy";

async function updateAdminPassword() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const validationError = validateNewPassword(password, password);
  if (!username || validationError) {
    throw new Error("ADMIN_USERNAME と要件を満たす ADMIN_PASSWORD が必要です");
  }
  const [admin] = await db
    .update(users)
    .set({
      password: await bcrypt.hash(password!, 10),
      credentialState: "active",
      authVersion: sql`${users.authVersion} + 1`,
    })
    .where(and(eq(users.username, username), eq(users.role, "admin")))
    .returning({ id: users.id, username: users.username });
  if (!admin) throw new Error("Admin user was not found");
  console.log("Admin password updated", { id: admin.id, username: admin.username });
}

updateAdminPassword()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Failed to update admin password");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
