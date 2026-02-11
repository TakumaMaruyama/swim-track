import { Express } from "express";
import { db } from "db";
import { swimRecords, users, announcements } from "db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import cors from 'cors';

// Add CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://swimtrack.repl.co'] 
    : ['http://localhost:5173', 'http://172.31.128.56:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export function registerRoutes(app: Express) {
  // Enable CORS with credentials
  app.use(cors(corsOptions));

  // Public endpoints that don't require authentication
  app.get("/api/athletes", async (req, res) => {
    try {
      console.log('Fetching athletes...');
      const athletes = await db
        .select({
          id: users.id,
          username: users.username,
          nameKana: users.nameKana,
          isActive: users.isActive,
          role: users.role,
          gender: users.gender,
          joinDate: users.joinDate,
          allTimeStartDate: users.allTimeStartDate,
        })
        .from(users)
        .where(eq(users.role, 'student'))
        .orderBy(sql`COALESCE(${users.nameKana}, ${users.username})`);

      console.log('Athletes fetched successfully:', athletes.length);
      res.json(athletes);
    } catch (error) {
      console.error('Error fetching athletes:', error);
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

  // 選手登録エンドポイントを追加 (Admin only)
  app.post("/api/athletes", async (req, res) => {
    // 管理者権限チェック
    if (req.session.role !== "admin") {
      return res.status(403).json({ message: "管理者権限が必要です" });
    }

    try {
      const { username, gender = 'male', nameKana } = req.body;

      if (!username || typeof username !== 'string' || username.trim().length === 0) {
        return res.status(400).json({ message: "選手名は必須です" });
      }

      // Check if username already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username.trim()))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ message: "この選手名は既に使用されています" });
      }

      // Create new athlete
      const [athlete] = await db
        .insert(users)
        .values({
          username: username.trim(),
          nameKana: nameKana ? nameKana.trim() : null,
          password: await hashPassword("temporary"),
          role: "student",
          isActive: true,
          gender: gender,
        })
        .returning();

      const { password: _, ...athleteWithoutPassword } = athlete;
      res.json(athleteWithoutPassword);
    } catch (error) {
      console.error('Error creating athlete:', error);
      res.status(500).json({ message: "選手の作成に失敗しました" });
    }
  });

  app.get("/api/records", async (_req, res) => {
    try {
      const records = await db
        .select({
          id: swimRecords.id,
          style: swimRecords.style,
          distance: swimRecords.distance,
          time: swimRecords.time,
          date: swimRecords.date,
          poolLength: swimRecords.poolLength,
          studentId: swimRecords.studentId,
          isCompetition: swimRecords.isCompetition,
          competitionName: swimRecords.competitionName,
          competitionLocation: swimRecords.competitionLocation,
          athleteName: users.username,
          athleteGender: users.gender,
          athleteJoinDate: users.joinDate,
          athleteAllTimeStartDate: users.allTimeStartDate,
        })
        .from(swimRecords)
        .leftJoin(users, eq(swimRecords.studentId, users.id))
        .where(sql`${swimRecords.studentId} is not null`)
        .orderBy(desc(swimRecords.date));

      const recordsWithAthletes = records.map((record) => {
        const { athleteGender, ...baseRecord } = record;
        return {
          ...baseRecord,
          studentId: record.studentId as number,
          athleteName: baseRecord.athleteName || "Unknown",
          // Keep behavior: prefer gender from users table with fallback
          gender: athleteGender || "male",
          athleteJoinDate: baseRecord.athleteJoinDate || null,
          athleteAllTimeStartDate: baseRecord.athleteAllTimeStartDate || null,
        };
      });

      res.json(recordsWithAthletes);
    } catch (error) {
      console.error('Error fetching records:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          cause: error.cause
        });
      }
      res.status(500).json({
        message: "記録の取得に失敗しました",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Announcements API endpoints
  // Get latest announcement
  app.get("/api/announcements/latest", async (req, res) => {
    try {
      const [latestAnnouncement] = await db
        .select()
        .from(announcements)
        .orderBy(desc(announcements.updatedAt))
        .limit(1);
      
      res.json(latestAnnouncement || { content: "" });
    } catch (error) {
      console.error('Error fetching latest announcement:', error);
      res.status(500).json({ message: "お知らせの取得に失敗しました" });
    }
  });
  
  // Admin only: Create or update announcement
  app.post("/api/admin/announcements", async (req, res) => {
    try {
      console.log("Announcement update request from:", req.session);
      
      if (req.session.role !== "admin") {
        console.log("Unauthorized attempt to update announcement. Session:", req.session);
        return res.status(403).json({ message: "管理者権限が必要です" });
      }
      
      const { content } = req.body;
      console.log("Received announcement content:", content);
      
      if (typeof content !== 'string') {
        console.log("Invalid announcement content received");
        return res.status(400).json({ message: "お知らせ内容は文字列である必要があります" });
      }
      
      // Get latest announcement to determine if we should update or create
      const [latestAnnouncement] = await db
        .select()
        .from(announcements)
        .orderBy(desc(announcements.updatedAt))
        .limit(1);
      
      console.log("Latest announcement:", latestAnnouncement);
      
      let announcement;
      
      if (latestAnnouncement) {
        // Update existing announcement
        console.log("Updating existing announcement ID:", latestAnnouncement.id);
        [announcement] = await db
          .update(announcements)
          .set({ 
            content: content.trim(),
            updatedAt: new Date(),
            createdBy: req.session.userId
          })
          .where(eq(announcements.id, latestAnnouncement.id))
          .returning();
      } else {
        // Create new announcement
        console.log("Creating new announcement");
        [announcement] = await db
          .insert(announcements)
          .values({
            content: content.trim(),
            createdBy: req.session.userId
          })
          .returning();
      }
      
      console.log("Announcement update successful:", announcement);
      res.json(announcement);
    } catch (error) {
      console.error('Error updating announcement:', error);
      
      // Provide more detailed error information
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      
      res.status(500).json({ 
        message: "お知らせの更新に失敗しました",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Records API endpoints
  app.post("/api/records", async (req, res) => {
    try {
      const { style, distance, time, date, poolLength, studentId, isCompetition, competitionName, competitionLocation, gender } = req.body;

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
          competitionLocation: competitionLocation || null,
          gender
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
      const { style, distance, time, date, poolLength, studentId, isCompetition, competitionName, competitionLocation, gender } = req.body;

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
          competitionLocation: competitionLocation || null,
          gender
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

  // Delete athlete and associated records (Admin only)
  app.delete("/api/athletes/:id", async (req, res) => {
    // 管理者権限チェック
    if (req.session.role !== "admin") {
      return res.status(403).json({ message: "管理者権限が必要です" });
    }

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

  // Update athlete status (Admin only)
  app.patch("/api/athletes/:id/status", async (req, res) => {
    // 管理者権限チェック
    if (req.session.role !== "admin") {
      return res.status(403).json({ message: "管理者権限が必要です" });
    }

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

  // Update athlete (Admin only)
  app.put("/api/athletes/:id", async (req, res) => {
    // 管理者権限チェック
    if (req.session.role !== "admin") {
      return res.status(403).json({ message: "管理者権限が必要です" });
    }

    const { id } = req.params;
    const { username, gender, nameKana } = req.body;

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
      const { joinDate, allTimeStartDate } = req.body;
      const nextJoinDate = joinDate ? new Date(joinDate) : athlete.joinDate;
      const nextAllTimeStartDate = allTimeStartDate === undefined
        ? athlete.allTimeStartDate
        : (allTimeStartDate ? new Date(allTimeStartDate) : null);

      const [updatedAthlete] = await db
        .update(users)
        .set({ 
          username,
          nameKana: nameKana !== undefined ? (nameKana ? nameKana.trim() : null) : athlete.nameKana,
          gender: gender || athlete.gender || 'male',
          joinDate: nextJoinDate,
          allTimeStartDate: nextAllTimeStartDate
        })
        .where(eq(users.id, parseInt(id)))
        .returning();

      res.json(updatedAthlete);
    } catch (error) {
      console.error('Error updating athlete:', error);
      res.status(500).json({ message: "選手の更新に失敗しました" });
    }
  });

  // CSVダウンロードエンドポイントを追加
  app.get("/api/records/download", async (req, res) => {
    try {
      console.log('Fetching records for CSV download...');
      // Set a longer timeout for this request
      res.setTimeout(30000); // 30 seconds timeout

      const records = await db
        .select({
          swimmer_name: users.username,
          style: swimRecords.style,
          distance: swimRecords.distance,
          total_time: swimRecords.time,
          date: swimRecords.date,
          pool_length: swimRecords.poolLength,
          competition_name: swimRecords.competitionName,
        })
        .from(swimRecords)
        .leftJoin(users, eq(swimRecords.studentId, users.id))
        .orderBy(desc(swimRecords.date));

      // CSVヘッダー
      const csvHeader = [
        'swimmer_name',
        'pool_length',
        'date',
        'style',
        'distance',
        'total_time',
        'competition_name'
      ].join(',');

      // CSVデータの生成
      const csvRows = records.map(record => [
        `"${record.swimmer_name}"`,
        record.pool_length,
        record.date ? new Date(record.date).toISOString().split('T')[0] : '',
        `"${record.style}"`,
        record.distance,
        `"${record.total_time}"`,
        record.competition_name ? `"${record.competition_name}"` : ''
      ].join(','));

      const csvContent = [csvHeader, ...csvRows].join('\n');

      // レスポンスヘッダーの設定
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="swim_records_${new Date().toISOString().split('T')[0]}.csv"`);

      res.send(csvContent);
    } catch (error) {
      console.error('Error generating CSV:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      res.status(500).json({ 
        message: "記録のダウンロードに失敗しました",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  async function hashPassword(password: string): Promise<string> {
    // Placeholder for password hashing logic
    return password; // Replace with actual hashing implementation
  }

  return app;
}
