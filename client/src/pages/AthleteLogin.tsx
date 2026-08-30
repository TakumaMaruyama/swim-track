import React from "react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

type Step = "identity" | "login" | "setup";

export default function AthleteLogin() {
  const { identify, login, setupPassword, isAuthenticated, mustChangePassword } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = React.useState<Step>("login");
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
      if (step === "identity") {
        const result = await identify(fullName.trim());
        const state = result.state || result.authState || result.status;
        setStep(
          result.requiresPasswordSetup ||
          state === "initial_setup" ||
          state === "setup_required" ||
          state === "uninitialized"
            ? "setup"
            : "login"
        );
      } else if (step === "setup") {
        if (password.length < 6) throw new Error("パスワードは6文字以上で入力してください");
        if (password !== confirmation) throw new Error("確認用パスワードが一致しません");
        const result = await setupPassword(fullName.trim(), password, confirmation);
        navigate(result.mustChangePassword ? "/change-password" : "/", { replace: true });
      } else {
        const result = await login({ fullName: fullName.trim(), password });
        const forced = Boolean(
          result.mustChangePassword ||
          result.user?.mustChangePassword ||
          result.state === "temp_password" ||
          result.authState === "temporary_password" ||
          result.user?.authState === "temp_password" ||
          result.user?.passwordState === "temporary"
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
    setStep("login");
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
          {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
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
            {step !== "identity" && (
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
              {loading ? "処理中..." : step === "identity" ? "次へ" : step === "setup" ? "設定してログイン" : "ログイン"}
            </Button>
            {step === "login" && <Button className="w-full" type="button" variant="ghost" onClick={() => { setStep("identity"); setPassword(""); setError(null); }} disabled={loading}>初めての方（パスワード設定）</Button>}
            {step !== "login" && <Button className="w-full" type="button" variant="ghost" onClick={resetIdentity} disabled={loading}>ログインに戻る</Button>}
            <Button className="w-full" type="button" variant="outline" onClick={() => navigate("/admin/login")}>管理者ログイン</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}