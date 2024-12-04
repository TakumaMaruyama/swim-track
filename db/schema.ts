import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("student"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow()
});

export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id)
});

export const documents = pgTable("documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  uploaderId: integer("uploader_id").references(() => users.id),
  categoryId: integer("category_id").references(() => categories.id),
  access: text("access").notNull().default("all"),
  createdAt: timestamp("created_at").defaultNow()
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
  competitionLocation: text("competition_location")
});

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof selectUserSchema>;

export const insertCategorySchema = createInsertSchema(categories);
export const selectCategorySchema = createSelectSchema(categories);
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = z.infer<typeof selectCategorySchema>;

export const insertDocumentSchema = createInsertSchema(documents);
export const selectDocumentSchema = createSelectSchema(documents);
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = z.infer<typeof selectDocumentSchema>;

export const insertRecordSchema = createInsertSchema(swimRecords);
export const selectRecordSchema = createSelectSchema(swimRecords);
export type InsertRecord = z.infer<typeof insertRecordSchema>;
export type SwimRecord = z.infer<typeof selectRecordSchema>;


