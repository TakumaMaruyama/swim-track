import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { db as poolDb, executeQuery } from "./pool";

// Export optimized database instance with performance configurations
import { withCache, generateCacheKey } from './cache';

// Optimized database instance with enhanced configurations
// Export database instance with proper typing and configuration
export const db = drizzle(poolDb, {
  schema: schema,
  logger: true
});

// Optimized query helpers
export async function findUserById(id: number) {
  const cacheKey = generateCacheKey('user', { id });
  return withCache(cacheKey, async () => {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    return user;
  });
}

export async function findDocumentsByCategory(categoryId: number) {
  const cacheKey = generateCacheKey('documents_by_category', { categoryId });
  return withCache(cacheKey, async () => {
    return db
      .select({
        id: schema.documents.id,
        title: schema.documents.title,
        filename: schema.documents.filename,
        categoryName: schema.categories.name,
        uploaderName: schema.users.username,
      })
      .from(schema.documents)
      .leftJoin(schema.categories, eq(schema.documents.categoryId, schema.categories.id))
      .leftJoin(schema.users, eq(schema.documents.uploaderId, schema.users.id))
      .where(eq(schema.documents.categoryId, categoryId))
      .orderBy(desc(schema.documents.createdAt));
  });
}

export async function findSwimRecordsByStudent(studentId: number) {
  const cacheKey = generateCacheKey('swim_records_by_student', { studentId });
  return withCache(cacheKey, async () => {
    return db
      .select({
        id: schema.swimRecords.id,
        style: schema.swimRecords.style,
        time: schema.swimRecords.time,
        date: schema.swimRecords.date,
        competitionName: schema.competitions.name,
      })
      .from(schema.swimRecords)
      .leftJoin(schema.competitions, eq(schema.swimRecords.competitionId, schema.competitions.id))
      .where(eq(schema.swimRecords.studentId, studentId))
      .orderBy(desc(schema.swimRecords.date));
  }, { ttl: 600 }); // 10 minutes cache for swim records
}

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

// Initialize prepared statements cache with proper typing
interface PreparedStatement {
  name: string;
  text: string;
  values?: any[];
}

const preparedStatementsCache = new Map<string, PreparedStatement>();

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
  const statements = Array.from(preparedStatementsCache.keys());
  for (const name of statements) {
    await poolDb.query(`DEALLOCATE IF EXISTS ${name}`);
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
