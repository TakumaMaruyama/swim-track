import React from "react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export default function ChangePassword() {
  const { changePassword, logout } = useAuth();
  const [, navigate] = useLocation();
  const [password, setPassword] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 6) return setError("パスワードは6文字以上で入力してください");
    if (password !== confirmation) return setError("確認用パスワードが一致しません");
    setLoading(true);
    try {
      await changePassword(password, confirmation);
      navigate("/", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "パスワードの変更に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle className="text-center text-2xl">パスワードを変更してください</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">仮パスワードでは他の画面を利用できません。本人用のパスワードを設定してください。</p>
          {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><label htmlFor="new-password" className="text-sm font-medium">新しいパスワード（6文字以上）</label><Input id="new-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
            <div className="space-y-2"><label htmlFor="new-password-confirmation" className="text-sm font-medium">パスワード（確認）</label><Input id="new-password-confirmation" type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "変更中..." : "パスワードを変更"}</Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => logout()} disabled={loading}>ログアウト</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}