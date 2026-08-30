declare module "connect-pg-simple" {
  import session from "express-session";
  import type { Pool } from "pg";

  interface StoreOptions {
    pool: Pool;
    tableName?: string;
    createTableIfMissing?: boolean;
  }

  type StoreConstructor = new (options: StoreOptions) => session.Store;
  export default function connectPgSimple(sessionModule: typeof session): StoreConstructor;
}