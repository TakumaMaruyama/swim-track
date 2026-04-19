import { runMigrations } from "./runMigrations";

async function main() {
  console.log('Migration started');
  await runMigrations();
  console.log('Migration completed');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed');
  console.error(err);
  process.exit(1);
});
