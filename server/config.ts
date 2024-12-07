import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment-specific .env file based on NODE_ENV
const env = process.env.NODE_ENV || "development";
config({
  path: path.resolve(process.cwd(), `.env.${env}`),
});

// Zod schema for environment variables
const envSchema = z.object({
  PORT: z.string().transform(val => parseInt(val, 10)).default("5000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url().default("postgresql://localhost:5432/swimtrack"),
  SESSION_SECRET: z.string().min(1, "Session secret is required"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  UPLOAD_DIR: z.string().default(path.join(__dirname, "..", "storage", "uploads")),
});

// Parse and validate environment variables
const validateEnv = () => {
  try {
    return envSchema.parse({
      PORT: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      SESSION_SECRET: process.env.SESSION_SECRET,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      UPLOAD_DIR: process.env.UPLOAD_DIR,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('\n');
      console.error("Environment validation failed:\n", errorMessages);
      throw new Error("Invalid environment configuration");
    }
    throw error;
  }
};

const env_vars = validateEnv();

// Type-safe configuration object
interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  sessionSecret: string;
  googleClientId?: string;
  googleClientSecret?: string;
  uploadDir: string;
}

const configuration: Config = {
  port: env_vars.PORT,
  nodeEnv: env_vars.NODE_ENV,
  databaseUrl: env_vars.DATABASE_URL,
  sessionSecret: env_vars.SESSION_SECRET,
  googleClientId: env_vars.GOOGLE_CLIENT_ID,
  googleClientSecret: env_vars.GOOGLE_CLIENT_SECRET,
  uploadDir: env_vars.UPLOAD_DIR,
};

export default configuration;
