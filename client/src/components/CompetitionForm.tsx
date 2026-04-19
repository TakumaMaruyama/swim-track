import React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { competitionSchema } from "@/lib/schema";

type CompetitionFormValues = z.infer<typeof competitionSchema>;

type QualifyingMeet = {
  id: string;
  name: string;
  level: "national" | "kyushu" | "kagoshima";
  season: number;
  course: "SCM" | "LCM" | "ANY";
  meetDate: string | null;
  meetDateEnd: string | null;
  metadata: Record<string, unknown> | null;
};

type CompetitionFormProps = {
  isOpen: boolean;
  competition?: CompetitionFormValues | null;
  onClose: () => void;
  onSubmit: (values: CompetitionFormValues) => Promise<void>;
};

const LEVEL_LABELS = {
  national: "全国レベル",
  kyushu: "九州レベル",
  kagoshima: "鹿児島県レベル",
} as const;

const COURSE_LABELS = {
  SCM: "短水路 (SCM)",
  LCM: "長水路 (LCM)",
  ANY: "どちらでも可 (ANY)",
} as const;

const buildDefaultValues = (competition?: CompetitionFormValues | null): CompetitionFormValues => ({
  id: competition?.id,
  name: competition?.name ?? "",
  location: competition?.location ?? "",
  date: competition?.date ?? new Date().toISOString().split('T')[0],
  isQualificationTarget: competition?.isQualificationTarget ?? false,
  qualifyingMeetId: competition?.qualifyingMeetId ?? null,
  qualifyingLevel: competition?.qualifyingLevel ?? null,
  qualifyingSeason: competition?.qualifyingSeason ?? new Date().getFullYear(),
  qualifyingCourse: competition?.qualifyingCourse ?? "SCM",
  createdAt: competition?.createdAt,
});

export function CompetitionForm({ isOpen, competition, onClose, onSubmit }: CompetitionFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CompetitionFormValues>({
    resolver: zodResolver(competitionSchema),
    defaultValues: buildDefaultValues(competition),
  });

  React.useEffect(() => {
    if (isOpen) {
      form.reset(buildDefaultValues(competition));
    }
  }, [competition, form, isOpen]);

  const isQualificationTarget = form.watch("isQualificationTarget");
  const qualifyingLevel = form.watch("qualifyingLevel");
  const qualifyingSeason = form.watch("qualifyingSeason");
  const qualifyingCourse = form.watch("qualifyingCourse");

  const shouldFetchMeets =
    isOpen &&
    isQualificationTarget &&
    !!qualifyingLevel &&
    !!qualifyingSeason &&
    !!qualifyingCourse;

  const { data: qualifyingMeetsResponse, isLoading: isLoadingMeets, error: qualifyingMeetsError } =
    useSWR<{ meets: QualifyingMeet[] }>(
      shouldFetchMeets
        ? `/api/qualifying-meets?level=${qualifyingLevel}&season=${qualifyingSeason}&course=${qualifyingCourse}`
        : null,
    );

  const qualifyingMeets = qualifyingMeetsResponse?.meets ?? [];

  React.useEffect(() => {
    if (!isQualificationTarget) {
      form.setValue("qualifyingMeetId", null, { shouldValidate: true });
      return;
    }

    const currentMeetId = form.getValues("qualifyingMeetId");
    if (currentMeetId && qualifyingMeets.some((meet) => meet.id === currentMeetId)) {
      return;
    }

    form.setValue("qualifyingMeetId", null, { shouldValidate: false });
  }, [form, isQualificationTarget, qualifyingMeets]);

  const handleSubmit = async (values: CompetitionFormValues) => {
    try {
      setIsSubmitting(true);

      const payload: CompetitionFormValues = {
        ...values,
        qualifyingMeetId: values.isQualificationTarget ? values.qualifyingMeetId ?? null : null,
        qualifyingLevel: values.isQualificationTarget ? values.qualifyingLevel ?? null : null,
        qualifyingSeason: values.isQualificationTarget ? values.qualifyingSeason ?? null : null,
        qualifyingCourse: values.isQualificationTarget ? values.qualifyingCourse ?? null : null,
      };

      const url = competition?.id ? `/api/competitions/${competition.id}` : '/api/competitions';
      const method = competition?.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || '大会情報の保存に失敗しました');
      }

      await onSubmit(payload);
      form.reset(buildDefaultValues(null));
    } catch (error) {
      console.error('Error saving competition:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: error instanceof Error ? error.message : "大会情報の保存に失敗しました",
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{competition ? "大会情報の編集" : "大会情報の追加"}</DialogTitle>
          <DialogDescription>
            大会情報を登録し、必要なら標準タイム連携の対象として設定します。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>大会名</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>開催場所</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>開催日</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isQualificationTarget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>標準タイム連携</FormLabel>
                  <FormControl>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                        disabled={isSubmitting}
                      />
                      この大会を「大会目標一覧」の対象にする
                    </label>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isQualificationTarget && (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                <FormField
                  control={form.control}
                  name="qualifyingLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>標準レベル</FormLabel>
                      <FormControl>
                        <select
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value
                                ? (event.target.value as CompetitionFormValues["qualifyingLevel"])
                                : null,
                            )
                          }
                          disabled={isSubmitting}
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">選択してください</option>
                          {Object.entries(LEVEL_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="qualifyingSeason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>シーズン</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? ""}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            field.onChange(nextValue ? Number.parseInt(nextValue, 10) : null);
                          }}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="qualifyingCourse"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>標準コース</FormLabel>
                      <FormControl>
                        <select
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value
                                ? (event.target.value as CompetitionFormValues["qualifyingCourse"])
                                : null,
                            )
                          }
                          disabled={isSubmitting}
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">選択してください</option>
                          {Object.entries(COURSE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="qualifyingMeetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>紐付ける外部大会</FormLabel>
                      <FormControl>
                        <select
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value || null)}
                          disabled={isSubmitting || !shouldFetchMeets || isLoadingMeets}
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">
                            {isLoadingMeets ? "読み込み中..." : "大会を選択してください"}
                          </option>
                          {qualifyingMeets.map((meet) => (
                            <option key={meet.id} value={meet.id}>
                              {meet.name}
                              {meet.meetDate ? ` (${meet.meetDate})` : ""}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      {qualifyingMeetsError && (
                        <p className="text-xs text-destructive">
                          外部大会の取得に失敗しました。API 設定を確認してください。
                        </p>
                      )}
                      {!qualifyingMeetsError && shouldFetchMeets && !isLoadingMeets && qualifyingMeets.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          条件に合う大会が見つかりませんでした。
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                キャンセル
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : competition ? (
                  "更新"
                ) : (
                  "追加"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
