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
  const [error, setError] = React.useState<string | null>(null);

  const validatePassword = (password: string): boolean => {
    if (password.length < 5) {
      setError("パスワードは5文字以上である必要があります");
      return false;
    }
    
    if (!/[A-Za-z]/.test(password)) {
      setError("パスワードは少なくとも1つのアルファベットを含む必要があります");
      return false;
    }

    setError(null);
    return true;
  };

  const handlePasswordUpdate = async () => {
    if (isSubmitting) return;

    setError(null);

    // Validate password
    if (!validatePassword(newPassword)) {
      toast({
        variant: "destructive",
        title: "入力エラー",
        description: error,
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("パスワードが一致しません");
      toast({
        variant: "destructive",
        title: "入力エラー",
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

      const data = await response.json().catch(() => ({
        message: "サーバーからの応答の解析に失敗しました"
      }));

      if (!response.ok) {
        const errorMessage = data.message || "パスワードの更新に失敗しました";
        console.error('[Password] Update failed:', data);
        throw new Error(errorMessage);
      }

      console.log('[Password] Update successful');
      toast({
        title: "更新成功",
        description: data.message || "パスワードが正常に更新されました",
        duration: 3000,
      });
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "パスワードの更新に失敗しました";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "エラー",
        description: errorMessage,
        duration: 5000,
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
              onChange={(e) => {
                setNewPassword(e.target.value);
                validatePassword(e.target.value);
              }}
              placeholder="新しいパスワード (5文字以上、アルファベットを含む)"
              disabled={isSubmitting}
              className={error ? "border-red-500" : ""}
            />
            {error && (
              <p className="text-xs text-red-500">
                {error}
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
              className={confirmPassword && newPassword !== confirmPassword ? "border-red-500" : ""}
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
