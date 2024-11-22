import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { db as poolDb, executeQuery } from "./pool";

// Export optimized database instance with query helpers
export const db = drizzle(poolDb, {
  logger: true,
  schema,
});

// Export query helper for optimized operations
export { executeQuery };

// Initialize prepared statements cache
const preparedStatementsCache = new Map<string, any>();

// Helper to get or create prepared statement
export async function getPreparedStatement(queryString: string, name: string) {
  if (!preparedStatementsCache.has(name)) {
    const statement = await poolDb.query(`PREPARE ${name} AS ${queryString}`);
    preparedStatementsCache.set(name, statement);
  }
  return preparedStatementsCache.get(name);
}

// Function to clear prepared statements cache
export async function clearPreparedStatements() {
  for (const [name] of preparedStatementsCache) {
    await poolDb.query(`DEALLOCATE ${name}`);
  }
  preparedStatementsCache.clear();
}

// Cleanup function for application shutdown
export async function cleanup() {
  await clearPreparedStatements();
}

// Handle cleanup on process termination
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
