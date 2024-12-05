import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export default function Login() {
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message);
      }

      window.location.href = "/";
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: error.message || "ログインに失敗しました",
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm p-6">
        <h1 className="text-2xl font-bold text-center mb-6">SwimTrack</h1>
        <div className="space-y-2">
          <Input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full">
          ログイン
        </Button>
      </form>
    </div>
  );
}
