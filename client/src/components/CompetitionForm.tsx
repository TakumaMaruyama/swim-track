import React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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

type CompetitionFormProps = {
  isOpen: boolean;
  competition?: CompetitionFormValues | null;
  onClose: () => void;
  onSubmit: (values: CompetitionFormValues) => Promise<void>;
};

const buildDefaultValues = (competition?: CompetitionFormValues | null): CompetitionFormValues => ({
  id: competition?.id,
  name: competition?.name ?? "",
  location: competition?.location ?? "",
  date: competition?.date ?? new Date().toISOString().split('T')[0],
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

  const handleSubmit = async (values: CompetitionFormValues) => {
    try {
      setIsSubmitting(true);

      const payload: CompetitionFormValues = values;

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
            大会名・開催場所・開催日を登録します。
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
