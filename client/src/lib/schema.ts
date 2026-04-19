import * as z from "zod";

export const competitionSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, { message: "大会名は必須です" }),
  date: z.string().min(1, { message: "開催日は必須です" }),
  location: z.string().min(1, { message: "開催場所は必須です" }),
  isQualificationTarget: z.boolean().default(false),
  qualifyingMeetId: z.string().nullable().optional(),
  qualifyingLevel: z.enum(["national", "kyushu", "kagoshima"]).nullable().optional(),
  qualifyingSeason: z.number().nullable().optional(),
  qualifyingCourse: z.enum(["SCM", "LCM", "ANY"]).nullable().optional(),
  createdAt: z.string().optional()
}).superRefine((value, ctx) => {
  if (!value.isQualificationTarget) {
    return;
  }

  if (!value.qualifyingLevel) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "標準レベルを選択してください",
      path: ["qualifyingLevel"],
    });
  }

  if (!value.qualifyingSeason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "シーズンを入力してください",
      path: ["qualifyingSeason"],
    });
  }

  if (!value.qualifyingCourse) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "コースを選択してください",
      path: ["qualifyingCourse"],
    });
  }

  if (!value.qualifyingMeetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "紐付ける大会を選択してください",
      path: ["qualifyingMeetId"],
    });
  }
});

export type Competition = z.infer<typeof competitionSchema>;
