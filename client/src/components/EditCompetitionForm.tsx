import React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Competition } from "db/schema";
import * as z from "zod";

const editCompetitionSchema = z.object({
  name: z.string().min(2, "大会名は2文字以上である必要があります"),
  date: z.string().min(1, "日付を選択してください"),
  location: z.string().min(2, "開催場所は2文字以上である必要があります"),
});

type EditCompetitionFormProps = {
  competition?: Competition;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: z.infer<typeof editCompetitionSchema>) => Promise<void>;
};

export function EditCompetitionForm({ 
  competition, 
  isOpen, 
  onClose, 
  onSubmit 
}: EditCompetitionFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm({
    resolver: zodResolver(editCompetitionSchema),
    defaultValues: {
      name: competition?.name ?? "",
      date: competition ? new Date(competition.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      location: competition?.location ?? "",
    },
  });

  const handleSubmit = async (values: z.infer<typeof editCompetitionSchema>) => {
    try {
      setIsSubmitting(true);
      await onSubmit(values);
      toast({
        title: competition ? "更新成功" : "追加成功",
        description: competition ? "大会情報が更新されました" : "新しい大会が追加されました",
      });
      onClose();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: competition ? "大会情報の更新に失敗しました" : "大会の追加に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{competition ? "大会情報の編集" : "新規大会追加"}</DialogTitle>
          <DialogDescription>
            {competition ? "大会の情報を編集します" : "新しい大会を追加します"}
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
            <DialogFooter>
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
                    {competition ? "更新中..." : "追加中..."}
                  </>
                ) : (
                  competition ? "更新" : "追加"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
