import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import { LogLevel } from '../client/src/types/auth';

// Connection pool configuration
const POOL_CONFIG: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 30, // Increased for better concurrency
  min: 10, // Increased minimum connections
  idleTimeoutMillis: 600000, // 10 minutes idle timeout
  connectionTimeoutMillis: 5000, // Reduced connection timeout for faster failure detection
  statement_timeout: 20000, // Reduced statement timeout for better responsiveness
  allowExitOnIdle: false,
  keepAlive: true,
  application_name: 'swimtrack',
  query_timeout: 15000, // Reduced query timeout for better responsiveness
  idle_in_transaction_session_timeout: 15000, // Reduced idle transaction timeout
};

// Create the connection pool
const pool = new Pool(POOL_CONFIG);

// Log database events
pool.on('connect', () => {
  console.log({
    timestamp: new Date().toISOString(),
    system: 'Database',
    level: LogLevel.INFO,
    event: 'connection.new',
    message: 'New database connection established'
  });
});

pool.on('error', (err) => {
  console.log({
    timestamp: new Date().toISOString(),
    system: 'Database',
    level: LogLevel.ERROR,
    event: 'connection.error',
    error: err instanceof Error ? err.message : String(err)
  });
});

// Handle pool cleanup
process.on('SIGINT', async () => {
  try {
    await pool.end();
    console.log({
      timestamp: new Date().toISOString(),
      system: 'Database',
      level: LogLevel.INFO,
      event: 'connection.cleanup',
      message: 'Database pool cleaned up successfully'
    });
    process.exit(0);
  } catch (error) {
    console.log({
      timestamp: new Date().toISOString(),
      system: 'Database',
      level: LogLevel.ERROR,
      event: 'connection.cleanup',
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
});

// Export configured database instance
export const db = drizzle(pool, {
  logger: true
});

// Query helper with timeout and retries
export async function executeQuery<T>(
  queryFn: () => Promise<T>,
  options: {
    timeout?: number;
    retries?: number;
    operation?: string;
  } = {}
): Promise<T> {
  const { timeout = 30000, retries = 3, operation = 'unknown' } = options;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Query timeout after ${timeout}ms`));
        }, timeout);
      });

      const result = await Promise.race([queryFn(), timeoutPromise]);
      return result as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      console.log({
        timestamp: new Date().toISOString(),
        system: 'Database',
        level: LogLevel.ERROR,
        event: 'query.error',
        operation,
        attempt,
        error: lastError.message,
        willRetry: attempt < retries
      });

      if (attempt === retries) break;
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw lastError;
}
