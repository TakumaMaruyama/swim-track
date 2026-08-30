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

type ManagedUser = Pick<User, "id" | "username" | "role" | "isActive" | "credentialState">;

interface UserPasswordListProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserPasswordList({ isOpen, onClose }: UserPasswordListProps) {
  const { toast } = useToast();
  const { data: users, error, mutate } = useSWR<ManagedUser[]>("/api/users/passwords");
  const [editingUser, setEditingUser] = React.useState<number | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [passwordConfirmation, setPasswordConfirmation] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "ユーザー情報の取得に失敗しました",
      });
    }
  }, [error, toast]);

  const filteredUsers = React.useMemo(
    () => (users ?? []).filter((user) => user.role === "student"),
    [users],
  );

  const handlePasswordUpdate = async (userId: number) => {
    if (isSubmitting) return;
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "入力エラー", description: "パスワードは6文字以上で入力してください" });
      return;
    }
    if (newPassword !== passwordConfirmation) {
      toast({ variant: "destructive", title: "入力エラー", description: "確認用パスワードが一致しません" });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/admin/athletes/${userId}/temporary-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword, passwordConfirmation }),
        credentials: 'include',
      });

      if (!response.ok) throw new Error();

      await mutate();
      toast({
        title: "更新成功",
        description: "仮パスワードを設定し、選手の既存ログインを失効しました",
      });
      setEditingUser(null);
      setNewPassword("");
      setPasswordConfirmation("");
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
          <DialogTitle>選手の仮パスワード設定</DialogTitle>
          <DialogDescription>
            設定後、選手は仮パスワードでログインし、本人用パスワードへ変更します。値は再表示されません。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4 overflow-y-auto max-h-[60vh] pr-2">
          {filteredUsers.map((user) => (
            <Card key={user.id}>
              <CardContent className="flex justify-between items-center p-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.username}</span>
                  <Badge variant="secondary">選手</Badge>
                  {user.isActive !== undefined && (
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? '有効' : '無効'}
                    </Badge>
                  )}
                  {user.credentialState === "temporary" && (
                    <Badge variant="outline">仮パスワード</Badge>
                  )}
                  {user.credentialState === "setup_required" && (
                    <Badge variant="outline">初回設定待ち</Badge>
                  )}
                </div>
                {editingUser === user.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="新しいパスワード"
                      className="w-40"
                      disabled={isSubmitting}
                    />
                    <Input
                      type="password"
                      value={passwordConfirmation}
                      onChange={(e) => setPasswordConfirmation(e.target.value)}
                      placeholder="確認"
                      className="w-40"
                      disabled={isSubmitting}
                    />
                    <Button 
                      size="sm"
                      onClick={() => handlePasswordUpdate(user.id)}
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
                        setPasswordConfirmation("");
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
                    onClick={() => setEditingUser(user.id)}
                  >
                    仮パスワード設定
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
