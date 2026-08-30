import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  char,
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  check,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").unique().notNull(),
  loginKey: text("login_key"),
  nameKana: text("name_kana"),
  password: text("password").notNull(),
  credentialState: text("credential_state").notNull().default("active"),
  authVersion: integer("auth_version").notNull().default(1),
  passwordSetBy: integer("password_set_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  role: text("role").notNull().default("student"),
  isActive: boolean("is_active").notNull().default(true),
  gender: text("gender").notNull().default("male"),
  birthDate: timestamp("birth_date"),
  joinDate: timestamp("join_date"),
  allTimeStartDate: timestamp("all_time_start_date"),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => [
  check("users_credential_state_check", sql`${table.credentialState} in ('setup_required', 'temporary', 'active')`),
  check("users_student_login_key_check", sql`${table.role} <> 'student' OR ${table.loginKey} IS NOT NULL`),
  uniqueIndex("users_student_login_key_unique").on(table.loginKey).where(sql`${table.role} = 'student' AND ${table.loginKey} IS NOT NULL`),
]);

export const authAttempts = pgTable("swimtrack_auth_attempts", {
  keyHash: char("key_hash", { length: 64 }).primaryKey(),
  attemptCount: integer("attempt_count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
}, (table) => [
  check("swimtrack_auth_attempts_count_check", sql`${table.attemptCount} > 0`),
  index("swimtrack_auth_attempts_reset_idx").on(table.resetAt),
]);

export const announcements = pgTable("announcements", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id)
});


export const competitions = pgTable("competitions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  date: timestamp("date").notNull(),
  location: text("location").notNull(),
  isQualificationTarget: boolean("is_qualification_target").notNull().default(false),
  qualifyingMeetId: text("qualifying_meet_id"),
  qualifyingLevel: text("qualifying_level"),
  qualifyingSeason: integer("qualifying_season"),
  qualifyingCourse: text("qualifying_course"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const swimRecords = pgTable("swim_records", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  studentId: integer("student_id").references(() => users.id),
  style: text("style").notNull(),
  distance: integer("distance").notNull(),
  time: text("time").notNull(),
  date: timestamp("date").defaultNow(),
  poolLength: integer("pool_length").notNull().default(25),
  isCompetition: boolean("is_competition").default(false),
  competitionId: integer("competition_id").references(() => competitions.id),
  competitionName: text("competition_name"),
  competitionLocation: text("competition_location"),
  gender: text("gender").notNull().default("male")
});

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof selectUserSchema>;


export const insertRecordSchema = createInsertSchema(swimRecords);
export const selectRecordSchema = createSelectSchema(swimRecords);
export type InsertRecord = z.infer<typeof insertRecordSchema>;
export type SwimRecord = z.infer<typeof selectRecordSchema>;

export const insertCompetitionSchema = createInsertSchema(competitions);
export const selectCompetitionSchema = createSelectSchema(competitions);
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;
export type Competition = z.infer<typeof selectCompetitionSchema>;

export const insertAnnouncementSchema = createInsertSchema(announcements);
export const selectAnnouncementSchema = createSelectSchema(announcements);
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = z.infer<typeof selectAnnouncementSchema>;
