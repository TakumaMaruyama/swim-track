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
  publicOrigin: string;
  googleClientId?: string;
  googleClientSecret?: string;
  uploadDir: string;
}

const configuration: Config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  sessionSecret: process.env.SESSION_SECRET || "",
  publicOrigin:
    process.env.SWIMTRACK_PUBLIC_ORIGIN ||
    (process.env.NODE_ENV === "production" ? "https://swim-track.replit.app" : ""),
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, "..", "storage", "uploads"),
};

export default configuration;
