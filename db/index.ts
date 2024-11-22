import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { db as poolDb, executeQuery } from "./pool";

// Export optimized database instance with performance configurations
export const db = drizzle(poolDb, {
  logger: true,
  schema,
  // Enhanced query batching
  queryBatchMaxSize: 1000,
  prepareCacheSize: 100,
});

// Prepared statements for frequently used queries
const preparedStatements = {
  getUserById: 'get_user_by_id',
  getDocumentsByCategory: 'get_documents_by_category',
  getSwimRecordsByStudent: 'get_swim_records_by_student',
  getCompetitionsByDate: 'get_competitions_by_date'
};

// Initialize prepared statements
async function initializePreparedStatements() {
  try {
    await poolDb.query(`
      PREPARE ${preparedStatements.getUserById} AS
      SELECT * FROM users WHERE id = $1;
    `);
    
    await poolDb.query(`
      PREPARE ${preparedStatements.getDocumentsByCategory} AS
      SELECT d.*, c.name as category_name, u.username as uploader_name
      FROM documents d
      LEFT JOIN categories c ON d.category_id = c.id
      LEFT JOIN users u ON d.uploader_id = u.id
      WHERE d.category_id = $1
      ORDER BY d.created_at DESC;
    `);
    
    await poolDb.query(`
      PREPARE ${preparedStatements.getSwimRecordsByStudent} AS
      SELECT sr.*, c.name as competition_name
      FROM swim_records sr
      LEFT JOIN competitions c ON sr.competition_id = c.id
      WHERE sr.student_id = $1
      ORDER BY sr.date DESC;
    `);
    
    await poolDb.query(`
      PREPARE ${preparedStatements.getCompetitionsByDate} AS
      SELECT *
      FROM competitions
      WHERE date >= $1 AND date <= $2
      ORDER BY date DESC;
    `);
  } catch (error) {
    console.error('Failed to initialize prepared statements:', error);
  }
}

// Initialize prepared statements on module load
initializePreparedStatements();

// Export query helper for optimized operations
export { executeQuery, preparedStatements };

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
