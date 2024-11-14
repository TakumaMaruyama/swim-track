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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "../hooks/use-user";
import { insertUserSchema } from "db/schema";
import { useEffect } from "react";

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { 
    login, 
    isAuthenticated, 
    isLoading,
    isLoginPending,
    error: authError 
  } = useUser();
  
  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log('[Login] Not authenticated, showing login page');
    }

    if (isAuthenticated) {
      console.log('[Login] User is authenticated, navigating to dashboard');
      navigate('/');
    }
  }, [isLoading, isAuthenticated, navigate]);

  async function onSubmit(values: { username: string; password: string }) {
    try {
      console.log('[Login] Attempting login');
      const result = await login(values);
      
      if (result.ok) {
        console.log('[Login] Login successful');
        toast({
          title: "ログイン成功",
          description: "ダッシュボードに移動します",
        });
        navigate('/');
      } else {
        console.log('[Login] Login failed:', result.message);
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            form.setError(field as "username" | "password", {
              type: "manual",
              message: messages[0],
            });
          });
        } else {
          toast({
            variant: "destructive",
            title: "エラー",
            description: result.message,
          });
        }
      }
    } catch (error) {
      console.error('[Login] Unexpected error:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "予期せぬエラーが発生しました",
      });
    }
  }

  if (isLoading || isLoginPending) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">認証中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-screen-xl mx-auto py-4 px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="mb-8"
        >
          <Home className="h-4 w-4 mr-2" />
          ホームに戻る
        </Button>
      </div>
      <div className="container flex items-center justify-center py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              SwimTrack ログイン
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {authError?.field === "network" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{authError.message}</AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ユーザー名</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          disabled={form.formState.isSubmitting}
                          autoComplete="username"
                          className="bg-white"
                        />
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
                        <Input 
                          type="password" 
                          {...field} 
                          disabled={form.formState.isSubmitting}
                          autoComplete="current-password"
                          className="bg-white"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {authError?.field === "credentials" && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{authError.message}</AlertDescription>
                  </Alert>
                )}
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
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
              disabled={form.formState.isSubmitting}
            >
              新規登録
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
