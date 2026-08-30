import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  const { login, isAuthenticated, mustChangePassword } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      setLocation(mustChangePassword ? "/change-password" : "/athletes", { replace: true });
    }
  }, [isAuthenticated, mustChangePassword, setLocation]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login({ username, password });

      if (!result.ok) {
        throw new Error(result.message || "ログインに失敗しました");
      }

      // ログイン成功後、ダッシュボードへリダイレクト
      const requiresChange = Boolean(
        result.mustChangePassword ||
        result.user?.mustChangePassword ||
        result.state === "temp_password" ||
        result.authState === "temporary_password" ||
        result.user?.authState === "temp_password" ||
        result.user?.passwordState === "temporary"
      );
      setLocation(requiresChange ? "/change-password" : "/athletes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-2xl text-center">管理者ログイン</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                ユーザー名
              </label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                パスワード
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "ログイン中..." : "ログイン"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setLocation("/login")}
            >
              選手ログイン
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
