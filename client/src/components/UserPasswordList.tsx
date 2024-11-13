import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Edit2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import useSWR from "swr";
import type { User } from "db/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserPasswordListProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserPasswordList({ isOpen, onClose }: UserPasswordListProps) {
  const { toast } = useToast();
  const { data: users, error, mutate } = useSWR<User[]>("/api/users/passwords");
  const [editingUser, setEditingUser] = React.useState<number | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = React.useState(false);

  if (error) {
    toast({
      variant: "destructive",
      title: "エラー",
      description: "ユーザー情報の取得に失敗しました",
    });
  }

  const handlePasswordUpdate = async (userId: number) => {
    try {
      const response = await fetch(`/api/users/${userId}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: newPassword }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to update password');
      }

      await mutate();
      setEditingUser(null);
      setNewPassword("");
      
      toast({
        title: "更新成功",
        description: "パスワードが更新されました",
      });
    } catch (error) {
      console.error('Error updating password:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "パスワードの更新に失敗しました",
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>ユーザー一覧とパスワード管理</DialogTitle>
            <DialogDescription>
              ユーザーアカウントとパスワードの管理を行います
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4 overflow-y-auto max-h-[60vh] pr-2">
            {users?.map((user) => (
              <Card key={user.id}>
                <CardContent className="flex justify-between items-center p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{user.username}</span>
                    <Badge variant={user.role === 'coach' ? 'default' : 'secondary'}>
                      {user.role === 'coach' ? 'コーチ' : '選手'}
                    </Badge>
                  </div>
                  {editingUser === user.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="新しいパスワード"
                        className="w-40"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setIsConfirmDialogOpen(true);
                        }}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingUser(user.id)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog 
        open={isConfirmDialogOpen} 
        onOpenChange={setIsConfirmDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>パスワードを更新しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              このユーザーのパスワードが更新されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsConfirmDialogOpen(false);
              setEditingUser(null);
              setNewPassword("");
            }}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (editingUser) {
                  handlePasswordUpdate(editingUser);
                  setIsConfirmDialogOpen(false);
                }
              }}
            >
              更新
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
