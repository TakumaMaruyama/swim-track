/** Authentication error interface */
export interface AuthError {
  message: string;
  field?: "credentials" | "network" | "username" | "password";
  errors?: Record<string, string[]>;
  context?: Record<string, unknown>;
}

/** Authentication state interface */
export interface AuthState {
  isLoading: boolean;
  error: AuthError | null;
}

/** Authentication result interface */
export interface AuthResult {
  ok: boolean;
  message?: string;
  field?: AuthError['field'];
  errors?: Record<string, string[]>;
  user?: import("db/schema").User;
  context?: Record<string, unknown>;
}

/** Log levels enum for standardized logging */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info'
}

/** Authentication log interface */
export interface AuthLog {
  level: LogLevel;
  operation: 'login' | 'logout' | 'register' | 'validation' | 'error';
  status: 'success' | 'failure';
  username?: string;
  message: string;
  error?: unknown;
  context?: Record<string, unknown>;
}
