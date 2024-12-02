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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import useSWR from "swr";
import type { User } from "db/schema";

interface UserPasswordListProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserPasswordList({ isOpen, onClose }: UserPasswordListProps) {
  const { toast } = useToast();
  const { data: users, error, mutate } = useSWR<User[]>("/api/users/passwords");
  const [editingUser, setEditingUser] = React.useState<number | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [roleFilter, setRoleFilter] = React.useState<string>("all");

  React.useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "ユーザー情報の取得に失敗しました",
      });
    }
  }, [error, toast]);

  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    return users.filter(user => 
      roleFilter === "all" || user.role === roleFilter
    );
  }, [users, roleFilter]);

  const handlePasswordUpdate = async (userId: number) => {
    if (isSubmitting) return;

    // Validate password length
    if (newPassword.length < 8) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "パスワードは8文字以上である必要があります",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/users/${userId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "パスワードの更新に失敗しました");
      }

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
        description: error instanceof Error ? error.message : "パスワードの更新に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    return role === 'coach' ? 'default' : 'secondary';
  };

  const getRoleDisplayName = (role: string) => {
    return role === 'coach' ? 'コーチ' : '選手';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>パスワード管理</DialogTitle>
          <DialogDescription>
            ユーザーのパスワードを管理します
          </DialogDescription>
        </DialogHeader>
        <div className="mb-4">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="ロールで絞り込み" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="coach">コーチ</SelectItem>
              <SelectItem value="student">選手</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-4 mt-4 overflow-y-auto max-h-[60vh] pr-2">
          {filteredUsers.map((user) => (
            <Card key={user.id}>
              <CardContent className="flex justify-between items-center p-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.username}</span>
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    {getRoleDisplayName(user.role)}
                  </Badge>
                  {user.isActive !== undefined && (
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? '有効' : '無効'}
                    </Badge>
                  )}
                </div>
                {editingUser === user.id ? (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-2">
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="新しいパスワード (8文字以上)"
                        className="w-48"
                        disabled={isSubmitting}
                      />
                      {newPassword && newPassword.length < 8 && (
                        <p className="text-xs text-red-500">
                          パスワードは8文字以上である必要があります
                        </p>
                      )}
                    </div>
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
