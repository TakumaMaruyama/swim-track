import bcrypt from "bcryptjs";
import { db, pool } from "../db";
import { users } from "../db/schema";
import { validateNewPassword } from "../server/passwordPolicy";

async function createAdminUser() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const validationError = validateNewPassword(password, password);
  if (!username || validationError) {
    throw new Error("ADMIN_USERNAME と要件を満たす ADMIN_PASSWORD が必要です");
  }
  const [admin] = await db
    .insert(users)
    .values({
      username,
      password: await bcrypt.hash(password!, 10),
      credentialState: "active",
      authVersion: 1,
      role: "admin",
      isActive: true,
    })
    .returning({ id: users.id, username: users.username });
  console.log("Admin user created", { id: admin.id, username: admin.username });
}

createAdminUser()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Failed to create admin user");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
