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

type CompetitionFormProps = {
  competition?: {
    id: number;
    name: string;
    location: string;
    date: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: z.infer<typeof competitionSchema>, id?: number) => Promise<void>;
};

export function CompetitionForm({ competition, isOpen, onClose, onSubmit }: CompetitionFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm({
    resolver: zodResolver(competitionSchema),
    defaultValues: {
      name: competition?.name || "",
      location: competition?.location || "",
      date: competition?.date ? new Date(competition.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    },
  });

  const handleSubmit = async (values: z.infer<typeof competitionSchema>) => {
    try {
      setIsSubmitting(true);
      const url = competition ? `/api/competitions/${competition.id}` : '/api/competitions';
      const method = competition ? 'PUT' : 'POST';
      
      // 日付をJST (UTC+9) として解釈
      const dateObj = new Date(values.date + 'T00:00:00+09:00');
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          date: dateObj.toISOString(),
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '大会情報の追加に失敗しました');
      }

      await onSubmit(values, competition?.id);
      form.reset();
    } catch (error) {
      console.error('Error adding competition:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: error instanceof Error ? error.message : "大会情報の追加に失敗しました",
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{competition ? '大会情報の編集' : '大会情報の追加'}</DialogTitle>
          <DialogDescription>
            {competition ? '大会情報を編集します' : '新しい大会情報を登録します'}
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
                    <Input
                      type="date"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    追加中...
                  </>
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
