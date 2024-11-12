import { Express } from "express";
import { setupAuth } from "./auth";
import multer from "multer";
import { db } from "db";
import { documents, users, swimRecords, competitions } from "db/schema";
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

  // Ensure user is a coach
  const requireCoach = (req: any, res: any, next: any) => {
    if (req.user?.role !== "coach") {
      return res.status(403).json({ message: "コーチ権限が必要です" });
    }
    next();
  };

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
      const [competition] = await db
        .insert(competitions)
        .values({
          name,
          date: new Date(date),
          location,
        })
        .returning();
      res.json(competition);
    } catch (error) {
      console.error('Error creating competition:', error);
      res.status(500).json({ message: "大会の作成に失敗しました" });
    }
  });

  app.put("/api/competitions/:id", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, date, location } = req.body;
      
      const [competition] = await db
        .update(competitions)
        .set({
          name,
          date: new Date(date),
          location,
        })
        .where(eq(competitions.id, parseInt(id)))
        .returning();

      if (!competition) {
        return res.status(404).json({ message: "大会が見つかりません" });
      }

      res.json(competition);
    } catch (error) {
      console.error('Error updating competition:', error);
      res.status(500).json({ message: "大会の更新に失敗しました" });
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
      res.status(500).json({ message: "大会の削除に失敗しました" });
    }
  });

  // Athletes API
  app.get("/api/athletes", requireAuth, async (req, res) => {
    try {
      const { isActive } = req.query;
      const query = db
        .select()
        .from(users)
        .where(eq(users.role, "student"));

      // Add optional isActive filter
      if (isActive !== undefined) {
        query.where(and(
          eq(users.role, "student"), 
          eq(users.isActive, isActive === 'true')
        ));
      }

      const athletes = await query;
      res.json(athletes);
    } catch (error) {
      res.status(500).json({ message: "選手の取得に失敗しました" });
    }
  });

  // Update athlete status
  app.patch("/api/athletes/:id/status", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      const [athlete] = await db
        .update(users)
        .set({ isActive })
        .where(and(eq(users.id, parseInt(id)), eq(users.role, "student")))
        .returning();

      if (!athlete) {
        return res.status(404).json({ message: "選手が見つかりません" });
      }

      res.json(athlete);
    } catch (error) {
      console.error('Error updating athlete status:', error);
      res.status(500).json({ message: "ステータスの更新に失敗しました" });
    }
  });

  // Update athlete
  app.put("/api/athletes/:id", requireAuth, requireCoach, async (req, res) => {
    const { id } = req.params;
    const { username } = req.body;

    try {
      // Check if athlete exists and is a student
      const [athlete] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, parseInt(id)), eq(users.role, "student")))
        .limit(1);

      if (!athlete) {
        return res.status(404).json({ message: "選手が見つかりません" });
      }

      // Check if username is already taken by another user
      if (username !== athlete.username) {
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (existingUser) {
          return res.status(400).json({ message: "このユーザー名は既に使用されています" });
        }
      }

      // Update athlete
      const [updatedAthlete] = await db
        .update(users)
        .set({ username })
        .where(eq(users.id, parseInt(id)))
        .returning();

      res.json(updatedAthlete);
    } catch (error) {
      console.error('Error updating athlete:', error);
      res.status(500).json({ message: "選手の更新に失敗しました" });
    }
  });

  // Swim Records API
  app.get("/api/records", requireAuth, async (req, res) => {
    try {
      const records = await db
        .select({
          id: swimRecords.id,
          studentId: swimRecords.studentId,
          style: swimRecords.style,
          distance: swimRecords.distance,
          time: swimRecords.time,
          date: swimRecords.date,
          isCompetition: swimRecords.isCompetition,
          poolLength: swimRecords.poolLength,
          athleteName: users.username
        })
        .from(swimRecords)
        .leftJoin(users, eq(swimRecords.studentId, users.id))
        .orderBy(desc(swimRecords.date));
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "記録の取得に失敗しました" });
    }
  });

  app.get("/api/records/competitions", requireAuth, async (req, res) => {
    try {
      const records = await db
        .select({
          id: swimRecords.id,
          studentId: swimRecords.studentId,
          style: swimRecords.style,
          distance: swimRecords.distance,
          time: swimRecords.time,
          date: swimRecords.date,
          isCompetition: swimRecords.isCompetition,
          poolLength: swimRecords.poolLength,
          athleteName: users.username
        })
        .from(swimRecords)
        .leftJoin(users, eq(swimRecords.studentId, users.id))
        .where(eq(swimRecords.isCompetition, true))
        .orderBy(desc(swimRecords.date));
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "大会記録の取得に失敗しました" });
    }
  });

  // Create new record
  app.post("/api/records", requireAuth, requireCoach, async (req, res) => {
    try {
      const { studentId, style, distance, time, date, isCompetition } = req.body;

      // Verify student exists
      const [student] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, studentId), eq(users.role, "student")))
        .limit(1);

      if (!student) {
        return res.status(404).json({ message: "選手が見つかりません" });
      }

      const [record] = await db
        .insert(swimRecords)
        .values({
          studentId,
          style,
          distance,
          time,
          date: new Date(date),
          isCompetition,
        })
        .returning();

      res.json(record);
    } catch (error) {
      console.error('Error creating record:', error);
      res.status(500).json({ message: "記録の作成に失敗しました" });
    }
  });

  // Update record
  app.put("/api/records/:id", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;
      const { style, distance, time, date, isCompetition } = req.body;

      const [record] = await db
        .update(swimRecords)
        .set({
          style,
          distance,
          time,
          date: new Date(date),
          isCompetition,
        })
        .where(eq(swimRecords.id, parseInt(id)))
        .returning();

      if (!record) {
        return res.status(404).json({ message: "記録が見つかりません" });
      }

      res.json(record);
    } catch (error) {
      console.error('Error updating record:', error);
      res.status(500).json({ message: "記録の更新に失敗しました" });
    }
  });

  // Delete record
  app.delete("/api/records/:id", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;
      
      const [deletedRecord] = await db
        .delete(swimRecords)
        .where(eq(swimRecords.id, parseInt(id)))
        .returning();

      if (!deletedRecord) {
        return res.status(404).json({ message: "記録が見つかりません" });
      }

      res.json({ message: "記録を削除しました" });
    } catch (error) {
      console.error('Error deleting record:', error);
      res.status(500).json({ message: "記録の削除に失敗しました" });
    }
  });

  // Documents API
  app.post(
    "/api/documents/upload",
    requireAuth,
    requireCoach,
    upload.single("file"),
    async (req, res) => {
      if (!req.file || !req.body.title) {
        return res.status(400).json({ message: "ファイルとタイトルが必要です" });
      }

      try {
        const [document] = await db
          .insert(documents)
          .values({
            title: req.body.title,
            filename: req.file.filename,
            mimeType: req.file.mimetype,
            uploaderId: req.user!.id,
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

  return app;
}