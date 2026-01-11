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
import { User } from "db/schema";
import * as z from "zod";

const editAthleteSchema = z.object({
  username: z.string().min(2, "ユーザー名は2文字以上である必要があります"),
  gender: z.enum(["male", "female"]),
  joinDate: z.string().optional(),
});

type EditAthleteFormProps = {
  athlete: User;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: z.infer<typeof editAthleteSchema>) => Promise<void>;
};

export function EditAthleteForm({ athlete, isOpen, onClose, onSubmit }: EditAthleteFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm({
    resolver: zodResolver(editAthleteSchema),
    defaultValues: {
      username: athlete.username,
      gender: athlete.gender as "male" | "female",
      joinDate: athlete.joinDate ? new Date(athlete.joinDate).toISOString().split('T')[0] : '',
    },
  });

  const handleSubmit = async (values: z.infer<typeof editAthleteSchema>) => {
    try {
      setIsSubmitting(true);
      await onSubmit(values);
      toast({
        title: "更新成功",
        description: "選手情報が更新されました",
      });
      onClose();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "選手情報の更新に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>選手情報の編集</DialogTitle>
          <DialogDescription>
            選手の基本情報を編集します。この変更は即座に反映されます。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>選手名</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>性別</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      disabled={isSubmitting}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="male">男性</option>
                      <option value="female">女性</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="joinDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>加入日</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    加入日以降の記録のみが歴代記録に反映されます
                  </p>
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
                    更新中...
                  </>
                ) : (
                  "更新"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
