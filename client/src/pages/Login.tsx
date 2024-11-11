import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "../hooks/use-user";
import { insertUserSchema } from "db/schema";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { login, isAuthenticated, isLoading: isAuthChecking } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  
  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  async function onSubmit(values: { username: string; password: string }) {
    setIsLoading(true);
    const result = await login(values);
    setIsLoading(false);
    
    if (result.ok) {
      toast({
        title: "ログイン成功",
        description: "ダッシュボードに移動します",
      });
      navigate("/");
    } else {
      toast({
        variant: "destructive",
        title: "エラー",
        description: result.message,
      });
    }
  }

  if (isAuthChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container flex items-center justify-center min-h-screen py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            SwimTrack ログイン
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ユーザー名</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>パスワード</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ログイン中...
                  </>
                ) : (
                  "ログイン"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-gray-500 text-center">
            アカウントをお持ちでない方は
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/register")}
            disabled={isLoading}
          >
            新規登録
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
