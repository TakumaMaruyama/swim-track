import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import { LogLevel } from '../client/src/types/auth';

// Enhanced connection pool configuration with better error handling and monitoring
const POOL_CONFIG: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10, // Reduced for better resource management
  min: 2,  // Minimum connections needed
  idleTimeoutMillis: 30000, // 30 seconds idle timeout
  connectionTimeoutMillis: 5000, // 5 seconds connection timeout
  statement_timeout: 10000, // 10 seconds statement timeout
  query_timeout: 10000, // 10 seconds query timeout
  allowExitOnIdle: false,
  keepAlive: true,
  application_name: 'swimtrack',
  idle_in_transaction_session_timeout: 15000, // 15 seconds transaction timeout
  poolSize: 10, // Explicit pool size
  maxUses: 7500, // Maximum uses before a connection is retired
  // Additional error handling parameters
  max_retries: 3,
  retry_delay: 1000,
  error_handler: (err: Error) => {
    console.log({
      timestamp: new Date().toISOString(),
      system: 'Database',
      level: LogLevel.ERROR,
      event: 'connection.error',
      error: err.message,
      stack: err.stack,
      context: {
        application: 'swimtrack',
        environment: process.env.NODE_ENV
      }
    });
  }
};

// Create the connection pool with enhanced monitoring
const pool = new Pool({
  ...POOL_CONFIG,
  max: 10, // Reduced for better resource management
  min: 2,  // Minimum connections needed
  idleTimeoutMillis: 30000, // 30 seconds idle timeout
  connectionTimeoutMillis: 5000, // 5 seconds connection timeout
  statement_timeout: 10000, // 10 seconds statement timeout
  query_timeout: 10000, // 10 seconds query timeout
});

// Query performance monitoring
const queryStats = new Map<string, {
  count: number;
  totalTime: number;
  avgTime: number;
  slowQueries: number;
}>();

pool.on('query', (query) => {
  const start = process.hrtime();
  
  query.on('end', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds * 1000 + nanoseconds / 1000000;
    
    const stats = queryStats.get(query.text) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      slowQueries: 0,
    };
    
    stats.count++;
    stats.totalTime += duration;
    stats.avgTime = stats.totalTime / stats.count;
    if (duration > 1000) stats.slowQueries++;
    
    queryStats.set(query.text, stats);
    
    // Log slow queries
    if (duration > 1000) {
      console.log({
        timestamp: new Date().toISOString(),
        system: 'Database',
        level: LogLevel.WARN,
        event: 'query.slow',
        query: query.text,
        duration,
        params: query.values,
      });
    }
  });
});

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

// Enhanced query helper with timeout, retries, and detailed error tracking
// Enhanced query execution with proper state management
export async function executeQuery<T>(
  queryFn: () => Promise<T>,
  options: {
    timeout?: number;
    retries?: number;
    operation?: string;
    critical?: boolean;
    context?: Record<string, unknown>;
  } = {}
): Promise<T> {
  const { 
    timeout = 30000, 
    retries = 3, 
    operation = 'unknown',
    critical = false,
    context = {}
  } = options;
  let lastError: Error | null = null;
  const startTime = Date.now();

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
        duration: Date.now() - startTime,
        error: lastError.message,
        stack: lastError.stack,
        willRetry: attempt < retries,
        critical,
        ...context,
// Query performance monitoring
interface QueryStats {
  count: number;
  totalTime: number;
  avgTime: number;
  slowQueries: number;
}

interface ExtendedQueryStats extends QueryStats {
  errors: number;
  lastError?: Error;
}

const queryStats = new Map<string, QueryStats>();
const extendedQueryStats = new Map<string, ExtendedQueryStats>();

// Monitor query performance
export function monitorQueryPerformance(operation: string, duration: number, error?: Error) {
  const stats = queryStats.get(operation) || { count: 0, totalTime: 0, errors: 0 };
  stats.count++;
  stats.totalTime += duration;
  if (error) {
    stats.errors++;
    stats.lastError = error;
  }
  queryStats.set(operation, stats);

  // Log slow queries
  if (duration > 1000) {
    console.log({
      timestamp: new Date().toISOString(),
      system: 'Database',
      level: LogLevel.WARN,
      event: 'query.slow',
      operation,
      duration,
      averageTime: stats.totalTime / stats.count,
      errorRate: (stats.errors / stats.count) * 100
    });
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.log({
      timestamp: new Date().toISOString(),
      system: 'Database',
      level: LogLevel.ERROR,
      event: 'health.check',
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

// Periodic health checks
setInterval(checkDatabaseHealth, 60000);
        queryStats: {
          timeoutValue: timeout,
          maxRetries: retries,
          currentAttempt: attempt
        }
      });

      if (attempt === retries) break;
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw lastError;
}
