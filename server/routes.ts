import { Express } from "express";
import { setupAuth } from "./auth";
import multer from "multer";
import { db } from "db";
import { documents, users, swimRecords, competitions, categories } from "db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";
import { scrypt, timingSafeEqual, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const SALT_LENGTH = 32;
const HASH_LENGTH = 64;

// Valid pool lengths with proper type assertion
const POOL_LENGTHS = [15, 25, 50] as const;
type PoolLength = typeof POOL_LENGTHS[number];

// Use absolute path in persistent storage directory
const UPLOAD_DIR = path.join(process.env.HOME || process.cwd(), "storage/uploads");

/** Log levels enum for standardized logging */
enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info'
}

/**
 * Structured logging function for server operations
 */
function logServer(level: LogLevel, operation: string, message: string, context?: Record<string, unknown>) {
  console.log('[Server]', {
    timestamp: new Date().toISOString(),
    level,
    operation,
    message,
    ...context
  });
}

// Initialize upload directory with proper error handling
const initializeUploadDirectory = async () => {
  try {
    await fs.access(UPLOAD_DIR);
    logServer(LogLevel.INFO, 'storage', 'Storage directory exists', { path: UPLOAD_DIR });
  } catch {
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      await fs.chmod(UPLOAD_DIR, 0o777);
      logServer(LogLevel.INFO, 'storage', 'Storage directory created', { path: UPLOAD_DIR });
    } catch (error) {
      logServer(LogLevel.ERROR, 'storage', 'Failed to create storage directory', { error });
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
      logServer(LogLevel.ERROR, 'storage', 'Storage destination error', { error });
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

// Password hashing utility functions
const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(SALT_LENGTH);
  const hash = (await scryptAsync(password, salt, HASH_LENGTH)) as Buffer;
  const hashedPassword = Buffer.concat([hash, salt]);
  return hashedPassword.toString('hex');
};

// Validate pool length with proper type checking
const validatePoolLength = (value: number): value is PoolLength => {
  return POOL_LENGTHS.includes(value as PoolLength);
};

// Enhanced pool length validation with minimal logging
const validatePoolLengthMiddleware = (req: any, res: any, next: any) => {
  const poolLength = Number(req.body.poolLength);
  
  if (!validatePoolLength(poolLength)) {
    logServer(LogLevel.WARN, 'validation', 'Invalid pool length', {
      value: poolLength,
      allowed: POOL_LENGTHS.join(', ')
    });
    
    return res.status(400).json({
      message: "無効なプール長です",
      errors: {
        poolLength: [`プール長は ${POOL_LENGTHS.join(', ')}m のいずれかである必要があります。入力値: ${poolLength}m`]
      }
    });
  }

  next();
};

export function registerRoutes(app: Express) {
  // Initialize upload directory during route registration
  initializeUploadDirectory().catch(error => 
    logServer(LogLevel.ERROR, 'init', 'Failed to initialize upload directory', { error })
  );
  
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

      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, parseInt(id)))
        .limit(1);

      if (!document) {
        return res.status(404).json({ message: "ドキュメントが見つかりません" });
      }

      const filePath = path.join(UPLOAD_DIR, document.filename);

      try {
        await fs.access(filePath);
      } catch (error) {
        logServer(LogLevel.ERROR, 'documents', 'File access error', {
          id,
          path: filePath,
          error: error instanceof Error ? error.message : String(error)
        });
        return res.status(404).json({ message: "ファイルが見つかりません" });
      }

      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.filename)}"`);
      
      const fileStream = createReadStream(filePath);
      
      fileStream.on('error', (error) => {
        logServer(LogLevel.ERROR, 'documents', 'Streaming error', {
          id,
          path: filePath,
          error: error instanceof Error ? error.message : String(error)
        });
        if (!res.headersSent) {
          res.status(500).json({ message: "ファイルの読み込みに失敗しました" });
        }
      });

      fileStream.pipe(res);
    } catch (error) {
      logServer(LogLevel.ERROR, 'documents', 'Download error', {
        id: req.params.id,
        error: error instanceof Error ? error.message : String(error)
      });
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

      logServer(LogLevel.INFO, 'documents', 'Document uploaded successfully', { id: document.id });
      res.json(document);
    } catch (error) {
      logServer(LogLevel.ERROR, 'documents', 'Upload error', { error });
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

      await db
        .delete(documents)
        .where(eq(documents.id, parseInt(id)));

      res.json({ message: "ドキュメントが削除されました" });
    } catch (error) {
      logServer(LogLevel.ERROR, 'documents', 'Deletion error', { error });
      res.status(500).json({ message: "ドキュメントの削除に失敗しました" });
    }
  });

  // Password update endpoint with enhanced error handling
  app.put("/api/users/:id/password", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      
      const hashedPassword = await hashPassword(password);
      
      const [user] = await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, parseInt(id)))
        .returning();

      if (!user) {
        return res.status(404).json({ message: "ユーザーが見つかりません" });
      }

      res.json({ message: "パスワードが更新されました" });
    } catch (error) {
      logServer(LogLevel.ERROR, 'users', 'Password update error', { error });
      res.status(500).json({ message: "パスワードの更新に失敗しました" });
    }
  });

  // User passwords endpoint with standardized logging
  app.get("/api/users/passwords", requireAuth, requireCoach, async (req, res) => {
    try {
      const usersList = await db
        .select({
          id: users.id,
          username: users.username,
          role: users.role,
          isActive: users.isActive,
        })
        .from(users)
        .orderBy(users.username);

      res.json(usersList);
    } catch (error) {
      logServer(LogLevel.ERROR, 'users', 'Failed to fetch user list', { error });
      res.status(500).json({ message: "ユーザー情報の取得に失敗しました" });
    }
  });

  // Categories API endpoints with standardized error handling
  app.get("/api/categories", requireAuth, async (req, res) => {
    try {
      const allCategories = await db
        .select()
        .from(categories)
        .orderBy(categories.name);
      
      res.json(allCategories);
    } catch (error) {
      logServer(LogLevel.ERROR, 'categories', 'Failed to fetch categories', { error });
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
      logServer(LogLevel.ERROR, 'categories', 'Failed to create category', { error });
      res.status(500).json({ message: "カテゴリーの作成に失敗しました" });
    }
  });

  app.delete("/api/categories/:id", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;

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
      logServer(LogLevel.ERROR, 'categories', 'Failed to delete category', { error });
      res.status(500).json({ message: "カテゴリーの削除に失敗しました" });
    }
  });

  // Documents listing with standardized error handling
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
      logServer(LogLevel.ERROR, 'documents', 'Failed to fetch documents', { error });
      res.status(500).json({ message: "ドキュメントの取得に失敗しました" });
    }
  });

  // Competition Management API endpoints with standardized error handling
  app.get("/api/competitions", requireAuth, async (req, res) => {
    try {
      const allCompetitions = await db
        .select()
        .from(competitions)
        .orderBy(desc(competitions.date));
      res.json(allCompetitions);
    } catch (error) {
      logServer(LogLevel.ERROR, 'competitions', 'Failed to fetch competitions', { error });
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
      logServer(LogLevel.ERROR, 'competitions', 'Failed to create competition', { error });
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
      logServer(LogLevel.ERROR, 'competitions', 'Failed to update competition', { error });
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

  // Record creation endpoint with enhanced validation
  app.post("/api/records", requireAuth, requireCoach, async (req, res) => {
    try {
      const { style, distance, time, date, isCompetition, poolLength, studentId } = req.body;

      // Validate required fields
      if (!style || !distance || !time || !studentId) {
        return res.status(400).json({
          message: "必須フィールドが不足しています",
          errors: {
            style: !style ? "種目は必須です" : null,
            distance: !distance ? "距離は必須です" : null,
            time: !time ? "タイムは必須です" : null,
            studentId: !studentId ? "選手IDは必須です" : null
          }
        });
      }

      // Validate pool length
      if (!validatePoolLength(poolLength)) {
        return res.status(400).json({
          message: "無効なプール長です",
          errors: {
            poolLength: `プール長は ${POOL_LENGTHS.join(', ')}m のいずれかである必要があります`
          }
        });
      }

      const [record] = await db
        .insert(swimRecords)
        .values({
          style,
          distance: Number(distance),
          time,
          date: date ? new Date(date) : new Date(),
          isCompetition: isCompetition || false,
          poolLength: Number(poolLength),
          studentId: Number(studentId)
        })
        .returning();

      // Join with user data to return athlete name
      const [recordWithAthlete] = await db
        .select({
          id: swimRecords.id,
          style: swimRecords.style,
          distance: swimRecords.distance,
          time: swimRecords.time,
          date: swimRecords.date,
          isCompetition: swimRecords.isCompetition,
          poolLength: swimRecords.poolLength,
          studentId: swimRecords.studentId,
          athleteName: users.username
        })
        .from(swimRecords)
        .where(eq(swimRecords.id, record.id))
        .leftJoin(users, eq(swimRecords.studentId, users.id))
        .limit(1);

      res.json(recordWithAthlete);
    } catch (error) {
      logServer(LogLevel.ERROR, 'records', 'Failed to create record', { error });
      res.status(500).json({ message: "記録の作成に失敗しました" });
    }
  });

  // Record update endpoint with enhanced validation
  app.put("/api/records/:id", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;
      const { style, distance, time, date, isCompetition, poolLength, studentId } = req.body;

      // Validate required fields
      if (!style || !distance || !time || !studentId) {
        return res.status(400).json({
          message: "必須フィールドが不足しています",
          errors: {
            style: !style ? "種目は必須です" : null,
            distance: !distance ? "距離は必須です" : null,
            time: !time ? "タイムは必須です" : null,
            studentId: !studentId ? "選手IDは必須です" : null
          }
        });
      }

      // Validate pool length
      if (!validatePoolLength(poolLength)) {
        return res.status(400).json({
          message: "無効なプール長です",
          errors: {
            poolLength: `プール長は ${POOL_LENGTHS.join(', ')}m のいずれかである必要があります`
          }
        });
      }

      const [updatedRecord] = await db
        .update(swimRecords)
        .set({
          style,
          distance: Number(distance),
          time,
          date: date ? new Date(date) : new Date(),
          isCompetition: isCompetition || false,
          poolLength: Number(poolLength),
          studentId: Number(studentId)
        })
        .where(eq(swimRecords.id, parseInt(id)))
        .returning();

      if (!updatedRecord) {
        return res.status(404).json({ message: "記録が見つかりません" });
      }

      // Join with user data to return athlete name
      const [recordWithAthlete] = await db
        .select({
          id: swimRecords.id,
          style: swimRecords.style,
          distance: swimRecords.distance,
          time: swimRecords.time,
          date: swimRecords.date,
          isCompetition: swimRecords.isCompetition,
          poolLength: swimRecords.poolLength,
          studentId: swimRecords.studentId,
          athleteName: users.username
        })
        .from(swimRecords)
        .where(eq(swimRecords.id, updatedRecord.id))
        .leftJoin(users, eq(swimRecords.studentId, users.id))
        .limit(1);

      res.json(recordWithAthlete);
    } catch (error) {
      logServer(LogLevel.ERROR, 'records', 'Failed to update record', { error });
      res.status(500).json({ message: "記録の更新に失敗しました" });
    }
  });
      res.json({ message: "大会を削除しました" });
    } catch (error) {
      logServer(LogLevel.ERROR, 'competitions', 'Failed to delete competition', { error });
      res.status(500).json({ message: "大会の削除に失敗しました" });
    }
  });

  // Athletes API with standardized error handling
  app.get("/api/athletes", requireAuth, async (req, res) => {
    try {
      const { isActive } = req.query;
      const query = db
        .select()
        .from(users)
        .where(eq(users.role, "student"));

      if (isActive !== undefined) {
        const filteredAthletes = await query.where(
          eq(users.isActive, isActive === 'true')
        );
        res.json(filteredAthletes);
        return;
      }

      const athletes = await query;
      res.json(athletes);
    } catch (error) {
      logServer(LogLevel.ERROR, 'athletes', 'Failed to fetch athletes', { error });
      res.status(500).json({ message: "選手の取得に失敗しました" });
    }
  });

  // Delete athlete with standardized error handling
  app.delete("/api/athletes/:id", requireAuth, requireCoach, async (req, res) => {
    const { id } = req.params;
    
    try {
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

      await db
        .delete(swimRecords)
        .where(eq(swimRecords.studentId, parseInt(id)));

      await db
        .delete(users)
        .where(eq(users.id, parseInt(id)));

      res.json({ message: "選手と関連する記録が削除されました" });
    } catch (error) {
      logServer(LogLevel.ERROR, 'athletes', 'Failed to delete athlete', { error });
      res.status(500).json({ message: "選手の削除に失敗しました" });
    }
  });

  // Swim Records API with standardized error handling
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
      logServer(LogLevel.ERROR, 'records', 'Failed to fetch records', { error });
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
      logServer(LogLevel.ERROR, 'records', 'Failed to fetch competition records', { error });
      res.status(500).json({ message: "大会記録の取得に失敗しました" });
    }
  });

  // Create new record with enhanced pool length validation and standardized logging
  app.post("/api/records", requireAuth, validatePoolLengthMiddleware, async (req, res) => {
    try {
      const {
        style,
        distance,
        time,
        date,
        isCompetition,
        poolLength,
        competitionId,
        studentId
      } = req.body;

      logServer(LogLevel.INFO, 'records', 'Creating new record', {
        style,
        distance,
        poolLength: `${poolLength}m`,
        isCompetition,
        studentId
      });

      const [record] = await db
        .insert(swimRecords)
        .values({
          style,
          distance,
          time,
          date: new Date(date),
          isCompetition: isCompetition || false,
          poolLength,
          competitionId: competitionId || null,
          studentId
        })
        .returning();

      logServer(LogLevel.INFO, 'records', 'Record created successfully', {
        id: record.id,
        poolLength: `${record.poolLength}m`
      });
      res.json(record);
    } catch (error) {
      logServer(LogLevel.ERROR, 'records', 'Failed to create record', { error });
      res.status(500).json({ message: "記録の作成に失敗しました" });
    }
  });

  // Update record update endpoint with validation and standardized logging
  app.put("/api/records/:id", requireAuth, requireCoach, validatePoolLengthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const {
        style,
        distance,
        time,
        date,
        isCompetition,
        poolLength,
        competitionId
      } = req.body;

      logServer(LogLevel.INFO, 'records', 'Updating record', {
        id,
        style,
        distance,
        poolLength: `${poolLength}m`,
        isCompetition
      });

      const [record] = await db
        .update(swimRecords)
        .set({
          style,
          distance,
          time,
          date: new Date(date),
          isCompetition: isCompetition || false,
          poolLength,
          competitionId: competitionId || null
        })
        .where(eq(swimRecords.id, parseInt(id)))
        .returning();

      if (!record) {
        logServer(LogLevel.WARN, 'records', 'Record not found', { id });
        return res.status(404).json({ message: "記録が見つかりません" });
      }

      logServer(LogLevel.INFO, 'records', 'Record updated successfully', {
        id: record.id,
        poolLength: `${record.poolLength}m`
      });
      res.json(record);
    } catch (error) {
      logServer(LogLevel.ERROR, 'records', 'Failed to update record', { error });
      res.status(500).json({ message: "記録の更新に失敗しました" });
    }
  });

  // Delete record with standardized error handling
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
      logServer(LogLevel.ERROR, 'records', 'Failed to delete record', { error });
      res.status(500).json({ message: "記録の削除に失敗しました" });
    }
  });

  // Update athlete status with standardized error handling
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
      logServer(LogLevel.ERROR, 'athletes', 'Failed to update athlete status', { error });
      res.status(500).json({ message: "ステータスの更新に失敗しました" });
    }
  });

  // Update athlete with standardized error handling
  app.put("/api/athletes/:id", requireAuth, requireCoach, async (req, res) => {
    const { id } = req.params;
    const { username } = req.body;

    try {
      const [athlete] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, parseInt(id)), eq(users.role, "student")))
        .limit(1);

      if (!athlete) {
        return res.status(404).json({ message: "選手が見つかりません" });
      }

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

      const [updatedAthlete] = await db
        .update(users)
        .set({ username })
        .where(eq(users.id, parseInt(id)))
        .returning();

      res.json(updatedAthlete);
    } catch (error) {
      logServer(LogLevel.ERROR, 'athletes', 'Failed to update athlete', { error });
      res.status(500).json({ message: "選手の更新に失敗しました" });
    }
  });
}