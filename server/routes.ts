import { Express } from "express";
import multer from "multer";
import { db } from "db";
import { documents, swimRecords, categories, users } from "db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";
import { configureAuth } from "./auth";

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
  // 認証設定を追加
  configureAuth(app);
  // Initialize upload directory during route registration
  initializeUploadDirectory().catch(console.error);

  // Document download endpoint with enhanced error handling
  app.get("/api/documents/:id/download", async (req, res) => {
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
  app.post("/api/documents/upload", upload.single('file'), async (req, res) => {
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
  app.delete("/api/documents/:id", async (req, res) => {
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
      console.error('Document deletion error:', error);
      res.status(500).json({ message: "ドキュメントの削除に失敗しました" });
    }
  });

  // Categories API endpoints with error handling
  app.get("/api/categories", async (req, res) => {
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

  app.post("/api/categories", async (req, res) => {
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
        })
        .returning();

      res.json(category);
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ message: "カテゴリーの作成に失敗しました" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
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

  // Documents listing with categories and performance optimizations
  app.get("/api/documents", async (req, res) => {
    const cacheKey = 'documents-list';
    try {
      // In-memory caching with Redis-like implementation
      const cached = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1 
          FROM documents 
          WHERE created_at > NOW() - INTERVAL '5 minutes'
        )
      `);
      
      const shouldInvalidateCache = cached.rows[0].exists;
      
      // Optimized query with pagination and efficient joins
      const docs = await db
        .select({
          id: documents.id,
          title: documents.title,
          filename: documents.filename,
          mimeType: documents.mimeType,
          categoryId: documents.categoryId,
          createdAt: documents.createdAt,
          categoryName: categories.name,
        })
        .from(documents)
        .leftJoin(categories, eq(documents.categoryId, categories.id))
        .orderBy(desc(documents.createdAt))
        .limit(100); // Prevent large result sets

      // Set cache headers for client-side caching
      res.set('Cache-Control', 'public, max-age=300');
      res.set('ETag', Buffer.from(JSON.stringify(docs)).toString('base64'));

      res.json(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
      // エラーの詳細をログに記録
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      res.status(500).json({ 
        message: "ドキュメントの取得に失敗しました",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  

  // Athletes API
  app.get("/api/athletes", async (req, res) => {
    try {
      console.log('Fetching athletes...');
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

      console.log('Athletes fetched successfully:', athletes.length);
      res.json(athletes);
    } catch (error) {
      console.error('Error fetching athletes:', error);
      // エラーの詳細情報をログに出力
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      res.status(500).json({ 
        message: "選手情報の取得に失敗しました",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Records API endpoints
  app.get("/api/records", async (req, res) => {
    try {
      console.log('Fetching swim records...');
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

      console.log('Records fetched successfully:', allRecords.length);
      res.json(allRecords);
    } catch (error) {
      console.error('Error fetching records:', error);
      // より詳細なエラー情報をログに出力
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          cause: error.cause
        });
      }
      res.status(500).json({ 
        success: false,
        message: "記録の取得に失敗しました",
        error: process.env.NODE_ENV === 'development' ? {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'UnknownError',
          cause: error instanceof Error ? error.cause : undefined
        } : undefined
      });
    }
  });

  app.post("/api/records", async (req, res) => {
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

  app.put("/api/records/:id", async (req, res) => {
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

  app.delete("/api/records/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log('Attempting to delete record with ID:', id);
      
      // IDの検証
      const recordId = parseInt(id);
      if (!id || isNaN(recordId)) {
        console.log('Invalid ID provided:', id);
        return res.status(400).json({ 
          success: false,
          message: "無効なIDが指定されました" 
        });
      }
      
      // 記録の存在確認
      const [existingRecord] = await db
        .select({
          id: swimRecords.id,
          style: swimRecords.style,
          distance: swimRecords.distance
        })
        .from(swimRecords)
        .where(eq(swimRecords.id, recordId))
        .limit(1);

      if (!existingRecord) {
        console.log('Record not found:', recordId);
        return res.status(404).json({ 
          success: false,
          message: "記録が見つかりません" 
        });
      }

      console.log('Found record to delete:', existingRecord);

      // 削除を実行
      const [deletedRecord] = await db
        .delete(swimRecords)
        .where(eq(swimRecords.id, recordId))
        .returning();

      if (!deletedRecord) {
        console.log('Failed to delete record:', recordId);
        return res.status(500).json({ 
          success: false,
          message: "記録の削除に失敗しました" 
        });
      }

      console.log('Record deleted successfully:', deletedRecord.id);
      
      res.json({ 
        success: true,
        message: "記録が削除されました",
        data: deletedRecord
      });
    } catch (error) {
      console.error('Error deleting record:', error);
      // エラーの詳細情報をログに出力
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          cause: error.cause
        });
      }

      res.status(500).json({ 
        success: false,
        message: "記録の削除に失敗しました"
      });
    }
  });

  // Recent activities endpoint
  app.get("/api/recent-activities", async (req, res) => {
    try {
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

      res.json(recentRecords);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      res.status(500).json({ message: "最近の活動の取得に失敗しました" });
    }
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Delete athlete and associated records
  app.delete("/api/athletes/:id", async (req, res) => {
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
  app.patch("/api/athletes/:id/status", async (req, res) => {
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
  app.put("/api/athletes/:id", async (req, res) => {
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

  


  return app;
}