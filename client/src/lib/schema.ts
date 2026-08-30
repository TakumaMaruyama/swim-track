import * as z from "zod";

export const competitionSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, { message: "大会名は必須です" }),
  date: z.string().min(1, { message: "開催日は必須です" }),
  location: z.string().min(1, { message: "開催場所は必須です" }),
  createdAt: z.string().optional()
});

export type Competition = z.infer<typeof competitionSchema>;
