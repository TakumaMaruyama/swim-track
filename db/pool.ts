import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import { LogLevel } from '../client/src/types/auth';

// Connection pool configuration
const POOL_CONFIG: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  min: 5, // Minimum number of idle clients maintained in the pool
  idleTimeoutMillis: 300000, // Close idle clients after 5 minutes
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
  statement_timeout: 30000, // Cancel queries that take more than 30 seconds
  allowExitOnIdle: false,
  keepAlive: true,
  application_name: 'swimtrack', // For better query monitoring
  query_timeout: 30000, // Timeout for individual queries
  idle_in_transaction_session_timeout: 30000, // Timeout for idle transactions
  statement_cache_size: 100, // Cache prepared statements
  poolSize: 20 // Explicit pool size setting
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
