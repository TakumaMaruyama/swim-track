import React from "react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

type Step = "start" | "login" | "setup";

export default function AthleteLogin() {
  const { athleteStart, athleteLogin, setupPassword, isAuthenticated, mustChangePassword } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = React.useState<Step>("start");
  const [fullName, setFullName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (isAuthenticated) navigate(mustChangePassword ? "/change-password" : "/", { replace: true });
  }, [isAuthenticated, mustChangePassword, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (step === "start") {
        const result = await athleteStart(fullName.trim());
        setStep(result.credentialState === "setup_required" ? "setup" : "login");
      } else if (step === "setup") {
        if (password.length < 6) throw new Error("パスワードは6文字以上で入力してください");
        if (password !== confirmation) throw new Error("確認用パスワードが一致しません");
        const result = await setupPassword(password, confirmation);
        navigate(result.mustChangePassword ? "/change-password" : "/", { replace: true });
      } else {
        const result = await athleteLogin(fullName.trim(), password);
        const forced = Boolean(
          result.mustChangePassword ||
          result.credentialState === "temporary" ||
          result.user?.credentialState === "temporary" ||
          result.user?.mustChangePassword
        );
        navigate(forced ? "/change-password" : "/", { replace: true });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "認証に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const resetIdentity = () => {
    setStep("start");
    setPassword("");
    setConfirmation("");
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            {step === "setup" ? "初回パスワード設定" : "選手ログイン"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}<br />新規の場合は管理者に選手追加を依頼してください</AlertDescription></Alert>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="fullName" className="text-sm font-medium">登録済みの氏名（フルネーム）</label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={loading || step === "setup"}
                autoComplete="name"
                required
              />
              <p className="text-xs text-muted-foreground">空白の種類や有無にかかわらず照合されます。</p>
            </div>
            {step !== "start" && (
              <div className="space-y-2">
                <label htmlFor="athlete-password" className="text-sm font-medium">
                  {step === "setup" ? "新しいパスワード（6文字以上）" : "パスワード"}
                </label>
                <Input id="athlete-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={step === "setup" ? "new-password" : "current-password"} required minLength={step === "setup" ? 6 : undefined} />
              </div>
            )}
            {step === "setup" && (
              <div className="space-y-2">
                <label htmlFor="athlete-password-confirmation" className="text-sm font-medium">パスワード（確認）</label>
                <Input id="athlete-password-confirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required minLength={6} />
              </div>
            )}
            <Button className="w-full" type="submit" disabled={loading || !fullName.trim()}>
              {loading ? "処理中..." : step === "start" ? "次へ" : step === "setup" ? "設定してログイン" : "ログイン"}
            </Button>
            {step !== "start" && <Button className="w-full" type="button" variant="ghost" onClick={resetIdentity} disabled={loading}>氏名入力に戻る</Button>}
            <Button className="w-full" type="button" variant="outline" onClick={() => navigate("/admin/login")}>管理者ログイン</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
