import { Express } from "express";
import { setupAuth } from "./auth";
import multer from "multer";
import { db } from "db";
import { documents, users, swimRecords, categories, competitions } from "db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";
import { scrypt, timingSafeEqual, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const SALT_LENGTH = 32;
const HASH_LENGTH = 64;

// Use absolute path in persistent storage directory
const UPLOAD_DIR = path.join(process.env.HOME || process.cwd(), "storage/uploads");

// Update initialization to be more robust with proper permissions
const initializeUploadDirectory = async () => {
  try {
    await fs.access(UPLOAD_DIR);
    console.log('Storage directory exists:', UPLOAD_DIR);
  } catch {
    console.log('Creating storage directory:', UPLOAD_DIR);
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      // Set directory permissions to ensure persistence
      await fs.chmod(UPLOAD_DIR, 0o777);
      console.log('Storage directory created successfully with full permissions');
    } catch (error) {
      console.error('Failed to create storage directory:', error);
      throw error;
    }
  }
};

// Configure storage with better error handling
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await initializeUploadDirectory();
      cb(null, UPLOAD_DIR);
    } catch (error) {
      console.error('Storage destination error:', error);
      cb(error as Error, UPLOAD_DIR);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const safeFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${safeFilename}`);
  }
});

const upload = multer({ storage });



export function registerRoutes(app: Express) {
  // Initialize upload directory during route registration
  initializeUploadDirectory().catch(console.error);
  
  setupAuth(app);

  // Authentication middleware
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

  // Document download endpoint with enhanced error handling
  app.get("/api/documents/:id/download", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      console.log('Download request for document:', id);

      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, parseInt(id)))
        .limit(1);

      if (!document) {
        console.log('Document not found:', id);
        return res.status(404).json({ message: "ドキュメントが見つかりません" });
      }

      const filePath = path.join(UPLOAD_DIR, document.filename);
      console.log('Attempting to access file:', filePath);

      try {
        await fs.access(filePath);
      } catch (error) {
        console.error(`File access error for ${filePath}:`, error);
        return res.status(404).json({ message: "ファイルが見つかりません" });
      }

      // Set proper headers for download
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.filename)}"`);
      
      // Stream the file with proper error handling
      const fileStream = createReadStream(filePath);
      
      fileStream.on('error', (error) => {
        console.error(`File streaming error for ${filePath}:`, error);
        if (!res.headersSent) {
          res.status(500).json({ message: "ファイルの読み込みに失敗しました" });
        }
      });

      fileStream.pipe(res);
    } catch (error) {
      console.error('Document download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: "予期せぬエラーが発生しました" });
      }
    }
  });

  // Document upload endpoint with improved error handling
  app.post("/api/documents/upload", requireAuth, requireCoach, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "ファイルが選択されていません" });
      }

      // Verify file was saved successfully
      const filePath = path.join(UPLOAD_DIR, req.file.filename);
      try {
        await fs.access(filePath);
      } catch {
        return res.status(500).json({ message: "ファイルの保存に失敗しました" });
      }

      const { title, categoryId } = req.body;
      const [document] = await db
        .insert(documents)
        .values({
          title,
          filename: req.file.filename,
          mimeType: req.file.mimetype,
          uploaderId: req.user!.id,
          categoryId: categoryId === "none" ? null : parseInt(categoryId),
        })
        .returning();

      console.log('Document uploaded successfully:', document.id);
      res.json(document);
    } catch (error) {
      console.error('Document upload error:', error);
      res.status(500).json({ message: "ドキュメントのアップロードに失敗しました" });
    }
  });

  // Document deletion endpoint - only remove database entry, keep files
  app.delete("/api/documents/:id", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;

      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, parseInt(id)))
        .limit(1);

      if (!document) {
        return res.status(404).json({ message: "ドキュメントが見つかりません" });
      }

      // Only remove database entry, keep files for persistence
      await db
        .delete(documents)
        .where(eq(documents.id, parseInt(id)));

      res.json({ message: "ドキュメントが削除されました" });
    } catch (error) {
      console.error('Document deletion error:', error);
      res.status(500).json({ message: "ドキュメントの削除に失敗しました" });
    }
  });

  

  // Categories API endpoints with error handling
  app.get("/api/categories", requireAuth, async (req, res) => {
    try {
      const allCategories = await db
        .select()
        .from(categories)
        .orderBy(categories.name);
      
      res.json(allCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: "カテゴリーの取得に失敗しました" });
    }
  });

  app.post("/api/categories", requireAuth, requireCoach, async (req, res) => {
    try {
      const { name, description } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "カテゴリー名は必須です" });
      }

      const [category] = await db
        .insert(categories)
        .values({
          name: name.trim(),
          description: description?.trim(),
          createdBy: req.user!.id
        })
        .returning();

      res.json(category);
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ message: "カテゴリーの作成に失敗しました" });
    }
  });

  app.delete("/api/categories/:id", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;

      // Update documents to remove category reference
      await db
        .update(documents)
        .set({ categoryId: null })
        .where(eq(documents.categoryId, parseInt(id)));

      const [category] = await db
        .delete(categories)
        .where(eq(categories.id, parseInt(id)))
        .returning();

      if (!category) {
        return res.status(404).json({ message: "カテゴリーが見つかりません" });
      }

      res.json({ message: "カテゴリーが削除されました" });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ message: "カテゴリーの削除に失敗しました" });
    }
  });

  // Documents listing with categories
  app.get("/api/documents", requireAuth, async (req, res) => {
    try {
      const docs = await db
        .select({
          id: documents.id,
          title: documents.title,
          filename: documents.filename,
          mimeType: documents.mimeType,
          uploaderId: documents.uploaderId,
          categoryId: documents.categoryId,
          createdAt: documents.createdAt,
          categoryName: categories.name,
          uploaderName: users.username
        })
        .from(documents)
        .leftJoin(categories, eq(documents.categoryId, categories.id))
        .leftJoin(users, eq(documents.uploaderId, users.id))
        .orderBy(desc(documents.createdAt));

      res.json(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ message: "ドキュメントの取得に失敗しました" });
    }
  });

  

  // Competitions API
  app.get("/api/competitions", requireAuth, async (req, res) => {
    try {
      const competitionsData = await db
        .select({
          id: competitions.id,
          name: competitions.name,
          location: competitions.location,
          date: competitions.date,
          recordCount: sql<number>`(
            SELECT COUNT(*) FROM swim_records 
            WHERE competition_id = competitions.id
          )::int`,
        })
        .from(competitions)
        .orderBy(desc(competitions.date));

      res.json(competitionsData);
    } catch (error) {
      console.error('Error fetching competitions:', error);
      res.status(500).json({ message: "大会情報の取得に失敗しました" });
    }
  });

  app.post("/api/competitions", requireAuth, requireCoach, async (req, res) => {
    try {
      const { name, location, date } = req.body;
      
      if (!name || !location || !date) {
        return res.status(400).json({ message: "必須フィールドが不足しています" });
      }

      const [competition] = await db
        .insert(competitions)
        .values({
          name,
          location,
          date: new Date(date),
        })
        .returning();

      res.json(competition);
    } catch (error) {
      console.error('Error creating competition:', error);
      res.status(500).json({ message: "大会情報の作成に失敗しました" });
    }
  });

  // Athletes API
  app.get("/api/athletes", requireAuth, async (req, res) => {
    try {
      const athletes = await db
        .select({
          id: users.id,
          username: users.username,
          isActive: users.isActive,
          role: users.role,
        })
        .from(users)
        .where(eq(users.role, 'student'))
        .orderBy(users.username);

      res.json(athletes);
    } catch (error) {
      console.error('Error fetching athletes:', error);
      res.status(500).json({ message: "選手情報の取得に失敗しました" });
    }
  });

  // Records API endpoints
  app.get("/api/records", requireAuth, async (req, res) => {
  // Optimized records retrieval with aggregated data
  app.get("/api/records/aggregated", requireAuth, async (req, res) => {
    try {
      const aggregatedRecords = await db
        .select({
          id: swimRecords.id,
          style: swimRecords.style,
          distance: swimRecords.distance,
          time: swimRecords.time,
          date: swimRecords.date,
          poolLength: swimRecords.poolLength,
          studentId: swimRecords.studentId,
          athleteName: users.username,
          isCompetition: swimRecords.isCompetition,
          competitionName: swimRecords.competitionName,
          competitionLocation: swimRecords.competitionLocation,
          personalBest: sql<string>`MIN(${swimRecords.time}) OVER (
            PARTITION BY ${swimRecords.studentId}, ${swimRecords.style}, ${swimRecords.distance}, ${swimRecords.poolLength}
          )`,
          averageTime: sql<string>`AVG(${swimRecords.time}) OVER (
            PARTITION BY ${swimRecords.studentId}, ${swimRecords.style}, ${swimRecords.distance}, ${swimRecords.poolLength}
          )`,
          recordCount: sql<number>`COUNT(*) OVER (
            PARTITION BY ${swimRecords.studentId}, ${swimRecords.style}, ${swimRecords.distance}, ${swimRecords.poolLength}
          )`,
          ranking: sql<number>`RANK() OVER (
            PARTITION BY ${swimRecords.style}, ${swimRecords.distance}, ${swimRecords.poolLength}
            ORDER BY ${swimRecords.time}
          )`
        })
        .from(swimRecords)
        .leftJoin(users, eq(swimRecords.studentId, users.id))
        .orderBy(desc(swimRecords.date));

      res.json(aggregatedRecords);
    } catch (error) {
      console.error('Error fetching aggregated records:', error);
      res.status(500).json({ message: "記録の取得に失敗しました" });
    }
  });

  // Get statistics by style and distance
  app.get("/api/records/statistics", requireAuth, async (req, res) => {
    try {
      const statistics = await db
        .select({
          style: swimRecords.style,
          distance: swimRecords.distance,
          poolLength: swimRecords.poolLength,
          recordCount: sql<number>`COUNT(*)`,
          averageTime: sql<string>`AVG(${swimRecords.time})`,
          bestTime: sql<string>`MIN(${swimRecords.time})`,
          bestTimeAthlete: users.username,
        })
        .from(swimRecords)
        .leftJoin(users, eq(swimRecords.studentId, users.id))
        .groupBy(swimRecords.style, swimRecords.distance, swimRecords.poolLength, users.username)
        .orderBy(swimRecords.style, swimRecords.distance);

      res.json(statistics);
    } catch (error) {
      console.error('Error fetching record statistics:', error);
      res.status(500).json({ message: "統計情報の取得に失敗しました" });
    }
  });

  // Get athlete progress over time
  app.get("/api/records/progress/:studentId", requireAuth, async (req, res) => {
    try {
      const { studentId } = req.params;
      const progress = await db
        .select({
          id: swimRecords.id,
          style: swimRecords.style,
          distance: swimRecords.distance,
          time: swimRecords.time,
          date: swimRecords.date,
          poolLength: swimRecords.poolLength,
          improvement: sql<string>`LAG(${swimRecords.time}) OVER (
            PARTITION BY ${swimRecords.style}, ${swimRecords.distance}, ${swimRecords.poolLength}
            ORDER BY ${swimRecords.date}
          )`,
        })
        .from(swimRecords)
        .where(eq(swimRecords.studentId, parseInt(studentId)))
        .orderBy(swimRecords.date);

      res.json(progress);
    } catch (error) {
      console.error('Error fetching athlete progress:', error);
      res.status(500).json({ message: "進捗データの取得に失敗しました" });
    }
  });
    try {
      const allRecords = await db
        .select({
          id: swimRecords.id,
          style: swimRecords.style,
          distance: swimRecords.distance,
          time: swimRecords.time,
          date: swimRecords.date,
          poolLength: swimRecords.poolLength,
          studentId: swimRecords.studentId,
          athleteName: users.username,
          isCompetition: swimRecords.isCompetition,
          competitionName: swimRecords.competitionName,
          competitionLocation: swimRecords.competitionLocation
        })
        .from(swimRecords)
        .leftJoin(users, eq(swimRecords.studentId, users.id))
        .orderBy(desc(swimRecords.date));

      res.json(allRecords);
    } catch (error) {
      console.error('Error fetching records:', error);
      res.status(500).json({ message: "記録の取得に失敗しました" });
    }
  });

  // Update record endpoint
  app.put("/api/records/:id", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;
      const { style, distance, time, date, poolLength, studentId, isCompetition, competitionName, competitionLocation } = req.body;

      // Validate required fields
      if (!style || !distance || !time || !date) {
        return res.status(400).json({ message: "必須フィールドが不足しています" });
      }

      // First check if the record exists
      const [existingRecord] = await db
        .select()
        .from(swimRecords)
        .where(eq(swimRecords.id, parseInt(id)))
        .limit(1);

      if (!existingRecord) {
        return res.status(404).json({ message: "記録が見つかりません" });
      }

      // Then update the record
      const [updatedRecord] = await db
        .update(swimRecords)
        .set({
          style,
          distance,
          time,
          date: new Date(date),
          poolLength,
          studentId,
          isCompetition: isCompetition ?? false,
          competitionName: competitionName || null,
          competitionLocation: competitionLocation || null
        })
        .where(eq(swimRecords.id, parseInt(id)))
        .returning();

      res.json(updatedRecord);
    } catch (error) {
      console.error('Error updating record:', error);
      res.status(500).json({ message: "記録の更新に失敗しました" });
    }
  });

  // Delete record endpoint
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

      res.json({ message: "記録が削除されました" });
    } catch (error) {
      console.error('Error deleting record:', error);
      res.status(500).json({ message: "記録の削除に失敗しました" });
    }
  });
  // Recent activities endpoint
  app.get("/api/recent-activities", requireAuth, async (req, res) => {
    try {
      const recentCompetitions = await db
        .select({
          id: competitions.id,
          type: sql<'competition'>`'competition'::text`,
          date: competitions.date,
          name: competitions.name,
          location: competitions.location,
        })
        .from(competitions)
        .orderBy(desc(competitions.date))
        .limit(3);

      const recentRecords = await db
        .select({
          id: swimRecords.id,
          type: sql<'record'>`'record'::text`,
          date: swimRecords.date,
          style: swimRecords.style,
          distance: swimRecords.distance,
          time: swimRecords.time,
          athleteName: users.username,
        })
        .from(swimRecords)
        .leftJoin(users, eq(swimRecords.studentId, users.id))
        .orderBy(desc(swimRecords.date))
        .limit(5);

      const activities = [...recentCompetitions, ...recentRecords]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      res.json(activities);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      res.status(500).json({ message: "最近の活動の取得に失敗しました" });
    }
  });


  app.post("/api/records", requireAuth, requireCoach, async (req, res) => {
    try {
      const { style, distance, time, date, poolLength, studentId, isCompetition, competitionName, competitionLocation } = req.body;

      const [record] = await db
        .insert(swimRecords)
        .values({
          style,
          distance,
          time,
          date: new Date(date),
          poolLength,
          studentId,
          isCompetition: isCompetition ?? false,
          competitionName: competitionName || null,
          competitionLocation: competitionLocation || null
        })
        .returning();

      res.json(record);
    } catch (error) {
      console.error('Error creating record:', error);
      res.status(500).json({ message: "記録の作成に失敗しました" });
    }
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Delete athlete and associated records
  app.delete("/api/athletes/:id", requireAuth, requireCoach, async (req, res) => {
    const { id } = req.params;
    
    try {
      // First verify the athlete exists and is a student
      const [athlete] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.id, parseInt(id)),
          eq(users.role, "student")
        ))
        .limit(1);

      if (!athlete) {
        return res.status(404).json({ message: "選手が見つかりません" });
      }

      // Delete associated records first
      await db
        .delete(swimRecords)
        .where(eq(swimRecords.studentId, parseInt(id)));

      // Then delete the athlete
      await db
        .delete(users)
        .where(eq(users.id, parseInt(id)));

      res.json({ message: "選手と関連する記録が削除されました" });
    } catch (error) {
      console.error('Error deleting athlete:', error);
      res.status(500).json({ message: "選手の削除に失敗しました" });
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
      const { studentId, style, distance, time, date, poolLength } = req.body;
      
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
          poolLength: poolLength,
        })
        .returning();

      res.json(record);
    } catch (error) {
      console.error('Error creating record:', error);
      res.status(500).json({ message: "記録の作成に失敗しました" });
    }
  });

  // Update record
  // Delete record
  app.delete("/api/records/:id", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;
      
      const [record] = await db
        .select()
        .from(swimRecords)
        .where(eq(swimRecords.id, parseInt(id)))
        .limit(1);

      if (!record) {
        return res.status(404).json({ message: "記録が見つかりません" });
      }

      await db
        .delete(swimRecords)
        .where(eq(swimRecords.id, parseInt(id)));

      res.json({ message: "記録を削除しました" });
    } catch (error) {
      console.error('Error deleting record:', error);
      res.status(500).json({ message: "記録の削除に失敗しました" });
    }
  });

  // Password management endpoints
  // Update the /api/users/passwords endpoint
  // app.get("/api/users/passwords", requireAuth, requireCoach, async (req, res) => {
  //   try {
  //     const students = await db
  //       .select({
  //         id: users.id,
  //         username: users.username,
  //         role: users.role,
  //         isActive: users.isActive,
  //       })
  //       .from(users)
  //       .where(eq(users.role, "student"))
  //       .orderBy(users.username);
  //
  //     res.json(students);
  //   } catch (error) {
  //     console.error('Error fetching student list:', error);
  //     res.status(500).json({ message: "学生情報の取得に失敗しました" });
  //   }
  // });
  //
  // // Add password update endpoint
  // app.put("/api/users/:id/password", requireAuth, requireCoach, async (req, res) => {
  //   try {
  //     const { id } = req.params;
  //     const { password } = req.body;
  //
  //     if (!password || password.length < 8) {
  //       return res.status(400).json({ message: "パスワードは8文字以上である必要があります" });
  //     }
  //
  //     // Hash the new password
  //     const hashedPassword = await crypto.hash(password);
  //
  //     // Update the user's password
  //     const [updatedUser] = await db
  //       .update(users)
  //       .set({ password: hashedPassword })
  //       .where(eq(users.id, parseInt(id)))
  //       .returning();
  //
  //     if (!updatedUser) {
  //       return res.status(404).json({ message: "ユーザーが見つかりません" });
  //     }
  //
  //     res.json({ message: "パスワードが更新されました" });
  //   } catch (error) {
  //     console.error('Error updating password:', error);
  //     res.status(500).json({ message: "パスワードの更新に失敗しました" });
  //   }
  // });

  return app;
}