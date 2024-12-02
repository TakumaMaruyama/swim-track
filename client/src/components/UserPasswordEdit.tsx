import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface UserPasswordEditProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserPasswordEdit({ isOpen, onClose }: UserPasswordEditProps) {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handlePasswordUpdate = async () => {
    if (isSubmitting) return;

    // Validate password
    if (newPassword.length < 8) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "パスワードは8文字以上である必要があります",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "パスワードが一致しません",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "パスワードの更新に失敗しました");
      }

      toast({
        title: "更新成功",
        description: "パスワードが更新されました",
      });
      setNewPassword("");
      setConfirmPassword("");
      onClose();
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>パスワード変更</DialogTitle>
          <DialogDescription>
            新しいパスワードを入力してください
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新しいパスワード (8文字以上)"
              disabled={isSubmitting}
            />
            {newPassword && newPassword.length < 8 && (
              <p className="text-xs text-red-500">
                パスワードは8文字以上である必要があります
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="パスワードの確認"
              disabled={isSubmitting}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500">
                パスワードが一致しません
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              キャンセル
            </Button>
            <Button
              onClick={handlePasswordUpdate}
              disabled={isSubmitting || !newPassword || !confirmPassword}
            >
              更新
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
