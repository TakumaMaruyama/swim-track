import { Express } from "express";
import cors from "cors";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";

import { db } from "db";
import { announcements, competitions, swimRecords, users } from "db/schema";
import configuration from "./config";
import { hashPassword } from "./auth";
import {
  buildImprovementSummary,
  buildQualificationProgress,
  fetchQualifyingMeets,
} from "./qualification";

const QUALIFICATION_LEVELS = ["national", "kyushu", "kagoshima"] as const;
const QUALIFICATION_COURSES = ["SCM", "LCM", "ANY"] as const;

type QualificationLevel = (typeof QUALIFICATION_LEVELS)[number];
type QualificationCourse = (typeof QUALIFICATION_COURSES)[number];

const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? ["https://swimtrack.repl.co"]
      : ["http://localhost:5173", "http://172.31.128.56:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

function requireAdmin(sessionRole: string | undefined) {
  return sessionRole === "admin";
}

function parseOptionalDate(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseRequiredDate(value: unknown) {
  const parsed = parseOptionalDate(value);
  if (!parsed) {
    throw new Error("日付の形式が正しくありません");
  }
  return parsed;
}

function isQualificationLevel(value: unknown): value is QualificationLevel {
  return typeof value === "string" && QUALIFICATION_LEVELS.includes(value as QualificationLevel);
}

function isQualificationCourse(value: unknown): value is QualificationCourse {
  return typeof value === "string" && QUALIFICATION_COURSES.includes(value as QualificationCourse);
}

function normalizeCompetitionPayload(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const date = parseRequiredDate(body.date);
  const isQualificationTarget = Boolean(body.isQualificationTarget);

  let qualifyingMeetId: string | null = null;
  let qualifyingLevel: QualificationLevel | null = null;
  let qualifyingSeason: number | null = null;
  let qualifyingCourse: QualificationCourse | null = null;

  if (isQualificationTarget) {
    qualifyingMeetId =
      typeof body.qualifyingMeetId === "string" && body.qualifyingMeetId.trim().length > 0
        ? body.qualifyingMeetId.trim()
        : null;
    qualifyingLevel = isQualificationLevel(body.qualifyingLevel) ? body.qualifyingLevel : null;
    const parsedSeason =
      typeof body.qualifyingSeason === "number"
        ? body.qualifyingSeason
        : typeof body.qualifyingSeason === "string" && body.qualifyingSeason.trim().length > 0
          ? Number.parseInt(body.qualifyingSeason, 10)
          : null;
    qualifyingSeason = typeof parsedSeason === "number" && Number.isFinite(parsedSeason)
      ? parsedSeason
      : null;
    qualifyingCourse = isQualificationCourse(body.qualifyingCourse)
      ? body.qualifyingCourse
      : null;

    if (!qualifyingMeetId || !qualifyingLevel || !qualifyingCourse || !qualifyingSeason) {
      throw new Error("標準タイム連携対象の大会には外部大会情報が必要です");
    }
  }

  if (!name || !location) {
    throw new Error("大会名と開催場所は必須です");
  }

  return {
    name,
    location,
    date,
    isQualificationTarget,
    qualifyingMeetId,
    qualifyingLevel,
    qualifyingSeason,
    qualifyingCourse,
  };
}

export function registerRoutes(app: Express) {
  app.use(cors(corsOptions));

  app.get("/api/athletes", async (_req, res) => {
    try {
      const athletes = await db
        .select({
          id: users.id,
          username: users.username,
          nameKana: users.nameKana,
          isActive: users.isActive,
          role: users.role,
          gender: users.gender,
          birthDate: users.birthDate,
          joinDate: users.joinDate,
          allTimeStartDate: users.allTimeStartDate,
        })
        .from(users)
        .where(eq(users.role, "student"))
        .orderBy(sql`COALESCE(${users.nameKana}, ${users.username})`);

      res.json(athletes);
    } catch (error) {
      console.error("Error fetching athletes:", error);
      res.status(500).json({ message: "選手情報の取得に失敗しました" });
    }
  });

  app.post("/api/athletes", async (req, res) => {
    if (!requireAdmin(req.session.role)) {
      return res.status(403).json({ message: "管理者権限が必要です" });
    }

    try {
      const { username, gender = "male", nameKana, birthDate } = req.body;
      const normalizedUsername = typeof username === "string" ? username.trim() : "";

      if (!normalizedUsername) {
        return res.status(400).json({ message: "選手名は必須です" });
      }

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, normalizedUsername))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ message: "この選手名は既に使用されています" });
      }

      const [athlete] = await db
        .insert(users)
        .values({
          username: normalizedUsername,
          nameKana: typeof nameKana === "string" && nameKana.trim().length > 0 ? nameKana.trim() : null,
          password: await hashPassword("temporary"),
          role: "student",
          isActive: true,
          gender,
          birthDate: parseOptionalDate(birthDate),
        })
        .returning();

      const { password: _password, ...athleteWithoutPassword } = athlete;
      res.json(athleteWithoutPassword);
    } catch (error) {
      console.error("Error creating athlete:", error);
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

      res.json(
        records.map((record) => ({
          ...record,
          studentId: record.studentId as number,
          athleteName: record.athleteName || "Unknown",
          gender: record.athleteGender || "male",
          athleteJoinDate: record.athleteJoinDate || null,
          athleteAllTimeStartDate: record.athleteAllTimeStartDate || null,
        })),
      );
    } catch (error) {
      console.error("Error fetching records:", error);
      res.status(500).json({ message: "記録の取得に失敗しました" });
    }
  });

  app.get("/api/competitions", async (_req, res) => {
    try {
      const rows = await db
        .select({
          id: competitions.id,
          name: competitions.name,
          location: competitions.location,
          date: competitions.date,
          isQualificationTarget: competitions.isQualificationTarget,
          qualifyingMeetId: competitions.qualifyingMeetId,
          qualifyingLevel: competitions.qualifyingLevel,
          qualifyingSeason: competitions.qualifyingSeason,
          qualifyingCourse: competitions.qualifyingCourse,
          recordCount: count(swimRecords.id),
        })
        .from(competitions)
        .leftJoin(swimRecords, eq(swimRecords.competitionId, competitions.id))
        .groupBy(competitions.id)
        .orderBy(asc(competitions.date), asc(competitions.name));

      res.json(
        rows.map((row) => ({
          ...row,
          recordCount: Number(row.recordCount ?? 0),
        })),
      );
    } catch (error) {
      console.error("Error fetching competitions:", error);
      res.status(500).json({ message: "大会情報の取得に失敗しました" });
    }
  });

  app.post("/api/competitions", async (req, res) => {
    if (!requireAdmin(req.session.role)) {
      return res.status(403).json({ message: "管理者権限が必要です" });
    }

    try {
      const payload = normalizeCompetitionPayload(req.body);
      const [competition] = await db
        .insert(competitions)
        .values(payload)
        .returning();

      res.json(competition);
    } catch (error) {
      console.error("Error creating competition:", error);
      res.status(400).json({
        message: error instanceof Error ? error.message : "大会情報の追加に失敗しました",
      });
    }
  });

  app.put("/api/competitions/:id", async (req, res) => {
    if (!requireAdmin(req.session.role)) {
      return res.status(403).json({ message: "管理者権限が必要です" });
    }

    try {
      const competitionId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(competitionId)) {
        return res.status(400).json({ message: "無効な大会IDです" });
      }

      const payload = normalizeCompetitionPayload(req.body);
      const [competition] = await db
        .update(competitions)
        .set(payload)
        .where(eq(competitions.id, competitionId))
        .returning();

      if (!competition) {
        return res.status(404).json({ message: "大会が見つかりません" });
      }

      res.json(competition);
    } catch (error) {
      console.error("Error updating competition:", error);
      res.status(400).json({
        message: error instanceof Error ? error.message : "大会情報の更新に失敗しました",
      });
    }
  });

  app.get("/api/qualifying-meets", async (req, res) => {
    if (!configuration.qualifyingTimesApiBaseUrl) {
      return res.status(503).json({ message: "標準タイムAPIの接続先が未設定です" });
    }

    const level = req.query.level;
    const parsedSeason =
      typeof req.query.season === "string" && req.query.season.trim().length > 0
        ? Number.parseInt(req.query.season, 10)
        : null;
    const season = typeof parsedSeason === "number" && Number.isFinite(parsedSeason) ? parsedSeason : null;
    const course =
      typeof req.query.course === "string" && isQualificationCourse(req.query.course)
        ? req.query.course
        : null;

    if (!isQualificationLevel(level)) {
      return res.status(400).json({ message: "level は必須です" });
    }

    try {
      const meets = await fetchQualifyingMeets(configuration.qualifyingTimesApiBaseUrl, {
        level,
        season,
        course,
      });

      res.json({ meets });
    } catch (error) {
      console.error("Error fetching qualifying meets:", error);
      res.status(502).json({ message: "標準タイムAPIから大会一覧を取得できませんでした" });
    }
  });

  app.get("/api/qualification-progress", async (_req, res) => {
    try {
      const [athletes, targetCompetitions, records] = await Promise.all([
        db
          .select({
            id: users.id,
            username: users.username,
            nameKana: users.nameKana,
            gender: users.gender,
            birthDate: users.birthDate,
            isActive: users.isActive,
          })
          .from(users)
          .where(eq(users.role, "student"))
          .orderBy(sql`COALESCE(${users.nameKana}, ${users.username})`),
        db
          .select({
            id: competitions.id,
            name: competitions.name,
            location: competitions.location,
            date: competitions.date,
            isQualificationTarget: competitions.isQualificationTarget,
            qualifyingMeetId: competitions.qualifyingMeetId,
            qualifyingLevel: competitions.qualifyingLevel,
            qualifyingSeason: competitions.qualifyingSeason,
            qualifyingCourse: competitions.qualifyingCourse,
          })
          .from(competitions)
          .where(eq(competitions.isQualificationTarget, true))
          .orderBy(asc(competitions.date), asc(competitions.name)),
        db
          .select({
            id: swimRecords.id,
            studentId: swimRecords.studentId,
            style: swimRecords.style,
            distance: swimRecords.distance,
            time: swimRecords.time,
            date: swimRecords.date,
            poolLength: swimRecords.poolLength,
          })
          .from(swimRecords)
          .where(sql`${swimRecords.studentId} is not null`)
          .orderBy(desc(swimRecords.date)),
      ]);

      const payload = await buildQualificationProgress({
        athletes: athletes.map((athlete) => ({
          ...athlete,
          gender: (athlete.gender || "male") as "male" | "female",
        })),
        competitions: targetCompetitions.map((competition) => ({
          ...competition,
          qualifyingLevel: isQualificationLevel(competition.qualifyingLevel)
            ? competition.qualifyingLevel
            : null,
          qualifyingCourse: isQualificationCourse(competition.qualifyingCourse)
            ? competition.qualifyingCourse
            : null,
        })),
        records,
        qualifyingTimesApiBaseUrl: configuration.qualifyingTimesApiBaseUrl,
      });

      res.json(payload);
    } catch (error) {
      console.error("Error building qualification progress:", error);
      res.status(500).json({ message: "大会目標一覧の生成に失敗しました" });
    }
  });

  app.get("/api/athletes/:id/improvement-summary", async (req, res) => {
    try {
      const athleteId = Number.parseInt(req.params.id, 10);
      const months = Number.parseInt(String(req.query.months ?? ""), 10);

      if (!Number.isFinite(athleteId)) {
        return res.status(400).json({ message: "無効な選手IDです" });
      }

      if (![1, 3, 6].includes(months)) {
        return res.status(400).json({ message: "months は 1, 3, 6 のいずれかで指定してください" });
      }

      const records = await db
        .select({
          id: swimRecords.id,
          studentId: swimRecords.studentId,
          style: swimRecords.style,
          distance: swimRecords.distance,
          time: swimRecords.time,
          date: swimRecords.date,
          poolLength: swimRecords.poolLength,
        })
        .from(swimRecords)
        .where(eq(swimRecords.studentId, athleteId))
        .orderBy(desc(swimRecords.date));

      res.json(
        buildImprovementSummary({
          athleteId,
          months,
          records,
        }),
      );
    } catch (error) {
      console.error("Error fetching improvement summary:", error);
      res.status(500).json({ message: "成長サマリーの取得に失敗しました" });
    }
  });

  app.get("/api/announcements/latest", async (_req, res) => {
    try {
      const [latestAnnouncement] = await db
        .select()
        .from(announcements)
        .orderBy(desc(announcements.updatedAt))
        .limit(1);

      res.json(latestAnnouncement || { content: "" });
    } catch (error) {
      console.error("Error fetching latest announcement:", error);
      res.status(500).json({ message: "お知らせの取得に失敗しました" });
    }
  });

  app.post("/api/admin/announcements", async (req, res) => {
    try {
      if (!requireAdmin(req.session.role)) {
        return res.status(403).json({ message: "管理者権限が必要です" });
      }

      const { content } = req.body;
      if (typeof content !== "string") {
        return res.status(400).json({ message: "お知らせ内容は文字列である必要があります" });
      }

      const [latestAnnouncement] = await db
        .select()
        .from(announcements)
        .orderBy(desc(announcements.updatedAt))
        .limit(1);

      let announcement;
      if (latestAnnouncement) {
        [announcement] = await db
          .update(announcements)
          .set({
            content: content.trim(),
            updatedAt: new Date(),
            createdBy: req.session.userId,
          })
          .where(eq(announcements.id, latestAnnouncement.id))
          .returning();
      } else {
        [announcement] = await db
          .insert(announcements)
          .values({
            content: content.trim(),
            createdBy: req.session.userId,
          })
          .returning();
      }

      res.json(announcement);
    } catch (error) {
      console.error("Error updating announcement:", error);
      res.status(500).json({ message: "お知らせの更新に失敗しました" });
    }
  });

  app.post("/api/records", async (req, res) => {
    try {
      const {
        style,
        distance,
        time,
        date,
        poolLength,
        studentId,
        isCompetition,
        competitionName,
        competitionLocation,
        gender,
      } = req.body;

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
          gender,
        })
        .returning();

      res.json(record);
    } catch (error) {
      console.error("Error creating record:", error);
      res.status(500).json({ message: "記録の作成に失敗しました" });
    }
  });

  app.put("/api/records/:id", async (req, res) => {
    try {
      const recordId = Number.parseInt(req.params.id, 10);
      const {
        style,
        distance,
        time,
        date,
        poolLength,
        studentId,
        isCompetition,
        competitionName,
        competitionLocation,
        gender,
      } = req.body;

      if (!style || !distance || !time || !date) {
        return res.status(400).json({ message: "必須フィールドが不足しています" });
      }

      const [existingRecord] = await db
        .select()
        .from(swimRecords)
        .where(eq(swimRecords.id, recordId))
        .limit(1);

      if (!existingRecord) {
        return res.status(404).json({ message: "記録が見つかりません" });
      }

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
          gender,
        })
        .where(eq(swimRecords.id, recordId))
        .returning();

      res.json(updatedRecord);
    } catch (error) {
      console.error("Error updating record:", error);
      res.status(500).json({ message: "記録の更新に失敗しました" });
    }
  });

  app.delete("/api/records/:id", async (req, res) => {
    try {
      const recordId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(recordId)) {
        return res.status(400).json({ success: false, message: "無効なIDが指定されました" });
      }

      const [existingRecord] = await db
        .select({
          id: swimRecords.id,
        })
        .from(swimRecords)
        .where(eq(swimRecords.id, recordId))
        .limit(1);

      if (!existingRecord) {
        return res.status(404).json({ success: false, message: "記録が見つかりません" });
      }

      const [deletedRecord] = await db
        .delete(swimRecords)
        .where(eq(swimRecords.id, recordId))
        .returning();

      res.json({
        success: true,
        message: "記録が削除されました",
        data: deletedRecord,
      });
    } catch (error) {
      console.error("Error deleting record:", error);
      res.status(500).json({ success: false, message: "記録の削除に失敗しました" });
    }
  });

  app.get("/api/recent-activities", async (_req, res) => {
    try {
      const recentRecords = await db
        .select({
          id: swimRecords.id,
          type: sql<"record">`'record'::text`,
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
      console.error("Error fetching recent activities:", error);
      res.status(500).json({ message: "最近の活動の取得に失敗しました" });
    }
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.delete("/api/athletes/:id", async (req, res) => {
    if (!requireAdmin(req.session.role)) {
      return res.status(403).json({ message: "管理者権限が必要です" });
    }

    const athleteId = Number.parseInt(req.params.id, 10);

    try {
      const [athlete] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, athleteId), eq(users.role, "student")))
        .limit(1);

      if (!athlete) {
        return res.status(404).json({ message: "選手が見つかりません" });
      }

      await db.delete(swimRecords).where(eq(swimRecords.studentId, athleteId));
      await db.delete(users).where(eq(users.id, athleteId));

      res.json({ message: "選手と関連する記録が削除されました" });
    } catch (error) {
      console.error("Error deleting athlete:", error);
      res.status(500).json({ message: "選手の削除に失敗しました" });
    }
  });

  app.patch("/api/athletes/:id/status", async (req, res) => {
    if (!requireAdmin(req.session.role)) {
      return res.status(403).json({ message: "管理者権限が必要です" });
    }

    try {
      const athleteId = Number.parseInt(req.params.id, 10);
      const { isActive } = req.body;

      const [athlete] = await db
        .update(users)
        .set({ isActive })
        .where(and(eq(users.id, athleteId), eq(users.role, "student")))
        .returning();

      if (!athlete) {
        return res.status(404).json({ message: "選手が見つかりません" });
      }

      res.json(athlete);
    } catch (error) {
      console.error("Error updating athlete status:", error);
      res.status(500).json({ message: "ステータスの更新に失敗しました" });
    }
  });

  app.put("/api/athletes/:id", async (req, res) => {
    if (!requireAdmin(req.session.role)) {
      return res.status(403).json({ message: "管理者権限が必要です" });
    }

    const athleteId = Number.parseInt(req.params.id, 10);
    const { username, gender, nameKana, joinDate, allTimeStartDate, birthDate } = req.body;

    try {
      const [athlete] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, athleteId), eq(users.role, "student")))
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
        .set({
          username,
          nameKana: nameKana !== undefined ? (nameKana ? nameKana.trim() : null) : athlete.nameKana,
          gender: gender || athlete.gender || "male",
          birthDate: birthDate === undefined ? athlete.birthDate : parseOptionalDate(birthDate),
          joinDate: joinDate ? new Date(joinDate) : athlete.joinDate,
          allTimeStartDate:
            allTimeStartDate === undefined
              ? athlete.allTimeStartDate
              : allTimeStartDate
                ? new Date(allTimeStartDate)
                : null,
        })
        .where(eq(users.id, athleteId))
        .returning();

      res.json(updatedAthlete);
    } catch (error) {
      console.error("Error updating athlete:", error);
      res.status(500).json({ message: "選手の更新に失敗しました" });
    }
  });

  app.get("/api/records/download", async (_req, res) => {
    try {
      res.setTimeout(30000);

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

      const csvHeader = [
        "swimmer_name",
        "pool_length",
        "date",
        "style",
        "distance",
        "total_time",
        "competition_name",
      ].join(",");

      const csvRows = records.map((record) =>
        [
          `"${record.swimmer_name}"`,
          record.pool_length,
          record.date ? new Date(record.date).toISOString().split("T")[0] : "",
          `"${record.style}"`,
          record.distance,
          `"${record.total_time}"`,
          record.competition_name ? `"${record.competition_name}"` : "",
        ].join(","),
      );

      const csvContent = [csvHeader, ...csvRows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="swim_records_${new Date().toISOString().split("T")[0]}.csv"`,
      );

      res.send(csvContent);
    } catch (error) {
      console.error("Error generating CSV:", error);
      res.status(500).json({ message: "記録のダウンロードに失敗しました" });
    }
  });

  return app;
}
