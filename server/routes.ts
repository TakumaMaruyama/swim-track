import { Express } from "express";
import { setupAuth } from "./auth";
import multer from "multer";
import { db } from "db";
import { documents, users, swimRecords } from "db/schema";
import { eq, and, desc } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({ storage });

export function registerRoutes(app: Express) {
  setupAuth(app);

  // Ensure user is authenticated
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "認証が必要です" });
    }
    next();
  };

  // Athletes API
  app.get("/api/athletes", requireAuth, async (req, res) => {
    try {
      const athletes = await db
        .select()
        .from(users)
        .where(eq(users.role, "student"));
      res.json(athletes);
    } catch (error) {
      res.status(500).json({ message: "選手の取得に失敗しました" });
    }
  });

  // Swim Records API
  app.get("/api/records", requireAuth, async (req, res) => {
    try {
      const records = await db
        .select()
        .from(swimRecords)
        .orderBy(desc(swimRecords.date));
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "記録の取得に失敗しました" });
    }
  });

  app.get("/api/records/competitions", requireAuth, async (req, res) => {
    try {
      const records = await db
        .select()
        .from(swimRecords)
        .where(eq(swimRecords.isCompetition, true))
        .orderBy(desc(swimRecords.date));
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "大会記録の取得に失敗しました" });
    }
  });

  // Documents API
  app.post(
    "/api/documents/upload",
    requireAuth,
    upload.single("file"),
    async (req, res) => {
      if (!req.file || !req.body.title) {
        return res.status(400).json({ message: "ファイルとタイトルが必要です" });
      }

      if (req.user?.role !== "coach") {
        return res.status(403).json({ message: "権限がありません" });
      }

      try {
        const [document] = await db
          .insert(documents)
          .values({
            title: req.body.title,
            filename: req.file.filename,
            mimeType: req.file.mimetype,
            uploaderId: req.user.id,
          })
          .returning();

        res.json(document);
      } catch (error) {
        res.status(500).json({ message: "アップロードに失敗しました" });
      }
    }
  );

  app.get("/api/documents", requireAuth, async (req, res) => {
    try {
      const docs = await db.select().from(documents);
      res.json(docs);
    } catch (error) {
      res.status(500).json({ message: "ドキュメントの取得に失敗しました" });
    }
  });

  app.get("/api/documents/:id/download", requireAuth, async (req, res) => {
    try {
      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, parseInt(req.params.id)))
        .limit(1);

      if (!document) {
        return res.status(404).json({ message: "ファイルが見つかりません" });
      }

      const filePath = path.join("uploads", document.filename);
      res.download(filePath);
    } catch (error) {
      res.status(500).json({ message: "ダウンロードに失敗しました" });
    }
  });
}
