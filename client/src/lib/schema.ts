import * as z from "zod";

export const competitionSchema = z.object({
  name: z.string().min(1, "大会名を入力してください"),
  location: z.string().min(1, "開催場所を入力してください"),
  date: z.string().min(1, "開催日を選択してください"),
});
