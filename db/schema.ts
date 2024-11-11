import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("student"),
  createdAt: timestamp("created_at").defaultNow()
});

export const documents = pgTable("documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  uploaderId: integer("uploader_id").references(() => users.id),
  access: text("access").notNull().default("all"), // all, coach-only
  createdAt: timestamp("created_at").defaultNow()
});

export const swimRecords = pgTable("swim_records", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  studentId: integer("student_id").references(() => users.id),
  style: text("style").notNull(), // freestyle, backstroke, etc
  distance: integer("distance").notNull(),
  time: text("time").notNull(),
  date: timestamp("date").defaultNow(),
  isCompetition: boolean("is_competition").default(false)
});

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof selectUserSchema>;

export const insertDocumentSchema = createInsertSchema(documents);
export const selectDocumentSchema = createSelectSchema(documents);
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = z.infer<typeof selectDocumentSchema>;

export const insertRecordSchema = createInsertSchema(swimRecords);
export const selectRecordSchema = createSelectSchema(swimRecords);
export type InsertRecord = z.infer<typeof insertRecordSchema>;
export type SwimRecord = z.infer<typeof selectRecordSchema>;
