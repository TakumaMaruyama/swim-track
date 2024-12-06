import * as z from "zod";

export const competitionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: "大会名は必須です" }),
  date: z.string().min(1, { message: "開催日は必須です" }),
  venue: z.string().min(1, { message: "開催場所は必須です" }),
  level: z.enum(["regional", "prefectural", "national", "international"], {
    required_error: "大会レベルを選択してください",
  }),
  description: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Competition = z.infer<typeof competitionSchema>;
