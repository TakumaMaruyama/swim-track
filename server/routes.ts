import { Express } from "express";
import { setupAuth } from "./auth";
import multer from "multer";
import { db } from "db";
import { documents, users, swimRecords, competitions, categories } from "db/schema";
import { eq, and, desc } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { scrypt, timingSafeEqual, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const SALT_LENGTH = 32;
const HASH_LENGTH = 64;

// Fix for ES modules __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(dirname(__filename), '..', 'uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

export function registerRoutes(app: Express) {
  setupAuth(app);

  // Middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "認証が必要です" });
    }
    next();
  };

  const requireCoach = (req: any, res: any, next: any) => {
    if (req.user?.role !== "coach") {
      return res.status(403).json({ message: "コーチ権限が必要です" });
    }
    next();
  };

  // Document management endpoints
  app.post("/api/documents/upload", requireAuth, requireCoach, upload.single("file"), async (req, res) => {
    try {
      if (!req.file || !req.body.title) {
        return res.status(400).json({ message: "ファイルとタイトルは必須です" });
      }

      const [document] = await db
        .insert(documents)
        .values({
          title: req.body.title,
          filename: req.file.filename,
          mimeType: req.file.mimetype,
          uploaderId: req.user!.id,
          categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : null,
          access: "all"
        })
        .returning();

      res.json(document);
    } catch (error) {
      console.error('Error uploading document:', error);
      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      res.status(500).json({ message: "ドキュメントのアップロードに失敗しました" });
    }
  });

  app.get("/api/documents/:id/download", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, parseInt(id)))
        .limit(1);

      if (!doc) {
        return res.status(404).json({ message: "ドキュメントが見つかりません" });
      }

      const filePath = path.join(uploadsDir, doc.filename);
      res.download(filePath, doc.filename);
    } catch (error) {
      console.error('Error downloading document:', error);
      res.status(500).json({ message: "ファイルのダウンロードに失敗しました" });
    }
  });

  // Competition Management API endpoints
  app.get("/api/competitions", requireAuth, async (req, res) => {
    try {
      const allCompetitions = await db
        .select()
        .from(competitions)
        .orderBy(desc(competitions.date));
      res.json(allCompetitions);
    } catch (error) {
      console.error('Error fetching competitions:', error);
      res.status(500).json({ message: "大会情報の取得に失敗しました" });
    }
  });

  app.post("/api/competitions", requireAuth, requireCoach, async (req, res) => {
    try {
      const { name, date, location } = req.body;
      
      if (!name || !date || !location) {
        return res.status(400).json({ message: "名前、日付、場所は必須です" });
      }

      // Validate date format
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "無効な日付形式です" });
      }

      const [competition] = await db
        .insert(competitions)
        .values({
          name: name.trim(),
          date: parsedDate,
          location: location.trim(),
        })
        .returning();

      res.json(competition);
    } catch (error) {
      console.error('Error creating competition:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "大会の作成に失敗しました" 
      });
    }
  });

  app.put("/api/competitions/:id", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, date, location } = req.body;
      
      if (!name || !date || !location) {
        return res.status(400).json({ message: "名前、日付、場所は必須です" });
      }

      // Validate date format
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "無効な日付形式です" });
      }

      const [competition] = await db
        .update(competitions)
        .set({
          name: name.trim(),
          date: parsedDate,
          location: location.trim(),
        })
        .where(eq(competitions.id, parseInt(id)))
        .returning();

      if (!competition) {
        return res.status(404).json({ message: "大会が見つかりません" });
      }

      res.json(competition);
    } catch (error) {
      console.error('Error updating competition:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "大会の更新に失敗しました" 
      });
    }
  });

  app.delete("/api/competitions/:id", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;
      
      const [deletedCompetition] = await db
        .delete(competitions)
        .where(eq(competitions.id, parseInt(id)))
        .returning();

      if (!deletedCompetition) {
        return res.status(404).json({ message: "大会が見つかりません" });
      }

      res.json({ message: "大会を削除しました" });
    } catch (error) {
      console.error('Error deleting competition:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "大会の削除に失敗しました" 
      });
    }
  });
}
