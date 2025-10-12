import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("student"),
  isActive: boolean("is_active").notNull().default(true),
  gender: text("gender").notNull().default("male"),
  createdAt: timestamp("created_at").defaultNow()
});

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

