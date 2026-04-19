import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { neon } from "@neondatabase/serverless";

export async function runMigrations(options?: { migrationsFolder?: string }) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL が設定されていないため migration を実行できません");
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  await migrate(db, {
    migrationsFolder: options?.migrationsFolder ?? "migrations",
  });
}
