import { Express } from "express";
import { setupAuth } from "./auth";
import multer from "multer";
import { db } from "db";
import { documents, users, swimRecords, competitions, categories } from "db/schema";
import { eq, and, desc } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";
import { scrypt, timingSafeEqual, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const SALT_LENGTH = 32;
const HASH_LENGTH = 64;

// Use absolute path to ensure persistence
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Update directory initialization
const initializeUploadDirectory = async () => {
  try {
    await fs.access(UPLOAD_DIR);
    console.log('Uploads directory exists:', UPLOAD_DIR);
  } catch {
    console.log('Creating uploads directory:', UPLOAD_DIR);
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
};

// Initialize storage with improved error handling
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await initializeUploadDirectory();
      console.log('Upload destination:', UPLOAD_DIR);
      cb(null, UPLOAD_DIR);
    } catch (error) {
      console.error('Storage destination error:', error);
      cb(error as Error, UPLOAD_DIR);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const safeFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${uniqueSuffix}-${safeFilename}`;
    console.log('Generated filename:', filename);
    cb(null, filename);
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

export function registerRoutes(app: Express) {
  setupAuth(app);

  // Initialize upload directory when server starts
  initializeUploadDirectory().catch(console.error);

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

  // Document download endpoint with improved error handling and logging
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

      // Set proper headers for file download
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.filename)}"`);
      
      // Stream file directly to response
      const fileStream = createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        console.error(`File streaming error for ${filePath}:`, error);
        if (!res.headersSent) {
          res.status(500).json({ message: "ファイルの読み込みに失敗しました" });
        }
      });
    } catch (error) {
      console.error('Document download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: "予期せぬエラーが発生しました" });
      }
    }
  });

  // Document upload endpoint without cleanup logic
  app.post("/api/documents/upload", requireAuth, requireCoach, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "ファイルが選択されていません" });
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

      res.json(document);
    } catch (error) {
      console.error('Document upload error:', error);
      res.status(500).json({ message: "ドキュメントのアップロードに失敗しました" });
    }
  });

  // Document deletion endpoint without cleanup logic
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

      // Delete from database first
      await db
        .delete(documents)
        .where(eq(documents.id, parseInt(id)));

      // No file deletion logic
      res.json({ message: "ドキュメントが削除されました" });
    } catch (error) {
      console.error('Document deletion error:', error);
      res.status(500).json({ message: "ドキュメントの削除に失敗しました" });
    }
  });

  // Add password update endpoint
  app.put("/api/users/:id/password", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      
      // Hash the new password
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
      console.error('Error updating password:', error);
      res.status(500).json({ message: "パスワードの更新に失敗しました" });
    }
  });

  // Update the /api/users/passwords endpoint to get both students and coaches
  app.get("/api/users/passwords", requireAuth, requireCoach, async (req, res) => {
    try {
      console.log('[Auth] Fetching user passwords list');
      const usersList = await db
        .select({
          id: users.id,
          username: users.username,
          role: users.role,
          isActive: users.isActive,
        })
        .from(users)
        .orderBy(users.role, users.username);

      res.json(usersList);
    } catch (error) {
      console.error('Error fetching user list:', error);
      res.status(500).json({ message: "ユーザー情報の取得に失敗しました" });
    }
  });

  // Categories API endpoints
  app.get("/api/categories", requireAuth, async (req, res) => {
    try {
      const allCategories = await db
        .select()
        .from(categories)
        .orderBy(categories.name);
      
      if (!allCategories) {
        return res.status(500).json({ message: "カテゴリーの取得に失敗しました" });
      }
      
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

      // Check if category with same name exists
      const existingCategory = await db
        .select()
        .from(categories)
        .where(eq(categories.name, name.trim()))
        .limit(1);

      if (existingCategory.length > 0) {
        return res.status(400).json({ message: "同名のカテゴリーが既に存在します" });
      }

      const [category] = await db
        .insert(categories)
        .values({
          name: name.trim(),
          description: description?.trim(),
          createdBy: req.user!.id
        })
        .returning();

      if (!category) {
        return res.status(500).json({ message: "カテゴリーの作成に失敗しました" });
      }

      res.json(category);
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ message: "カテゴリーの作成に失敗しました" });
    }
  });

  app.delete("/api/categories/:id", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Update documents to remove category reference first
      await db
        .update(documents)
        .set({ categoryId: null })
        .where(eq(documents.categoryId, parseInt(id)));
      
      // Delete the category
      const [deletedCategory] = await db
        .delete(categories)
        .where(eq(categories.id, parseInt(id)))
        .returning();

      if (!deletedCategory) {
        return res.status(404).json({ message: "カテゴリーが見つかりません" });
      }

      res.json({ message: "カテゴリーが削除されました" });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ message: "カテゴリーの削除に失敗しました" });
    }
  });

  // Update documents API to include categories and sorting
  app.get("/api/documents", requireAuth, async (req, res) => {
    try {
      const docs = await db
        .select({
          ...documents,
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
          poolLength: 15, // Force 15m pool length
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
      const { style, distance, time, date, isCompetition, poolLength } = req.body;

      const [record] = await db
        .update(swimRecords)
        .set({
          style,
          distance,
          time,
          date: new Date(date),
          isCompetition,
          poolLength,
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
      
      // Check if record exists before deletion
      const [record] = await db
        .select()
        .from(swimRecords)
        .where(eq(swimRecords.id, parseInt(id)))
        .limit(1);

      if (!record) {
        return res.status(404).json({ message: "記録が見つかりません" });
      }

      // Delete the record
      await db
        .delete(swimRecords)
        .where(eq(swimRecords.id, parseInt(id)));

      res.json({ message: "記録を削除しました" });
    } catch (error) {
      console.error('Error deleting record:', error);
      res.status(500).json({ message: "記録の削除に失敗しました" });
    }
  });

  // Categories API
  app.post("/api/categories", requireAuth, requireCoach, async (req, res) => {
    try {
      const { name, description } = req.body;
      const [category] = await db
        .insert(categories)
        .values({
          name,
          description,
          createdBy: req.user!.id
        })
        .returning();

      res.json(category);
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ message: "カテゴリーの作成に失敗しました" });
    }
  });

  app.get("/api/categories", requireAuth, async (req, res) => {
    try {
      const categoryList = await db
        .select({
          id: categories.id,
          name: categories.name,
          description: categories.description,
          createdAt: categories.createdAt,
          createdBy: categories.createdBy,
          documentCount: sql<number>`count(${documents.id})`
        })
        .from(categories)
        .leftJoin(documents, eq(documents.categoryId, categories.id))
        .groupBy(categories.id)
        .orderBy(categories.name);

      res.json(categoryList);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: "カテゴリーの取得に失敗しました" });
    }
  });

  app.put("/api/categories/:id", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const [category] = await db
        .update(categories)
        .set({ name, description })
        .where(eq(categories.id, parseInt(id)))
        .returning();

      if (!category) {
        return res.status(404).json({ message: "カテゴリーが見つかりません" });
      }

      res.json(category);
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({ message: "カテゴリーの更新に失敗しました" });
    }
  });

  app.delete("/api/categories/:id", requireAuth, requireCoach, async (req, res) => {
    try {
      const { id } = req.params;

      // First update all documents in this category to have no category
      await db
        .update(documents)
        .set({ categoryId: null })
        .where(eq(documents.categoryId, parseInt(id)));

      // Then delete the category
      const [deletedCategory] = await db
        .delete(categories)
        .where(eq(categories.id, parseInt(id)))
        .returning();

      if (!deletedCategory) {
        return res.status(404).json({ message: "カテゴリーが見つかりません" });
      }

      res.json({ message: "カテゴリーが削除されました" });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ message: "カテゴリーの削除に失敗しました" });
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