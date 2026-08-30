import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file if not in production
if (process.env.NODE_ENV !== "production") {
  config();
}

interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  sessionSecret: string;
  qualifyingTimesApiBaseUrl?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  uploadDir: string;
}

const configuration: Config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  sessionSecret: process.env.SESSION_SECRET || "",
  qualifyingTimesApiBaseUrl: process.env.QUALIFYING_TIMES_API_BASE_URL,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, "..", "storage", "uploads"),
};

export default configuration;
