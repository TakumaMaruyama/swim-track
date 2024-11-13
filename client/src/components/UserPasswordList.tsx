import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import useSWR from "swr";
import type { User } from "db/schema";

interface UserPasswordListProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserPasswordList({ isOpen, onClose }: UserPasswordListProps) {
  const { toast } = useToast();
  const { data: students, error, mutate } = useSWR<User[]>("/api/users/passwords");
  const [editingUser, setEditingUser] = React.useState<number | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "学生情報の取得に失敗しました",
      });
    }
  }, [error, toast]);

  const handlePasswordUpdate = async (userId: number) => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/users/${userId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
        credentials: 'include',
      });

      if (!response.ok) throw new Error();

      await mutate();
      toast({
        title: "更新成功",
        description: "パスワードが更新されました",
      });
      setEditingUser(null);
      setNewPassword("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "パスワードの更新に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>学生パスワード管理</DialogTitle>
          <DialogDescription>
            学生のパスワードを管理します
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4 overflow-y-auto max-h-[60vh] pr-2">
          {students?.map((student) => (
            <Card key={student.id}>
              <CardContent className="flex justify-between items-center p-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{student.username}</span>
                  <Badge variant={student.isActive ? 'default' : 'secondary'}>
                    {student.isActive ? '有効' : '無効'}
                  </Badge>
                </div>
                {editingUser === student.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="新しいパスワード"
                      className="w-40"
                      disabled={isSubmitting}
                    />
                    <Button 
                      size="sm"
                      onClick={() => handlePasswordUpdate(student.id)}
                      disabled={isSubmitting}
                    >
                      更新
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingUser(null);
                        setNewPassword("");
                      }}
                      disabled={isSubmitting}
                    >
                      キャンセル
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingUser(student.id)}
                  >
                    パスワード変更
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
