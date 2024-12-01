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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, Home, KeyRound, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "../hooks/use-user";
import { z } from "zod";
import { useState } from "react";

// ログインフォーム用のスキーマ
const loginFormSchema = z.object({
  username: z.string().optional(),
  password: z.string().min(1, "パスワードを入力してください"),
}).refine((data) => {
  // この関数は外部から渡されたisAdminLoginの値にアクセスできないため、
  // フォームデータの送信時に別途検証を行います
  return true;
});

type LoginFormData = z.infer<typeof loginFormSchema>;

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { login, isAuthenticated } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormData) {
    if (isSubmitting) return;

    // 管理者ログイン時のバリデーション
    if (isAdminLogin && !values.username) {
      form.setError("username", {
        type: "manual",
        message: "管理者名を入力してください",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setLoginError(null);

      // 一般ユーザーの場合はusernameを省略
      const loginData = {
        ...(isAdminLogin ? values : { password: values.password }),
        isAdminLogin
      };

      const result = await login(loginData);
      
      if (result.ok) {
        toast({
          title: "ログイン成功",
          description: "ダッシュボードに移動します",
        });
        navigate('/');
        return;
      }

      // Handle validation errors
      if ('errors' in result) {
        Object.entries(result.errors).forEach(([field, messages]) => {
          form.setError(field as keyof LoginFormData, {
            type: "manual",
            message: Array.isArray(messages) ? messages[0] : messages,
          });
        });
        return;
      }

      // Set error message
      setLoginError(result.message);
    } catch (error) {
      setLoginError("認証中にエラーが発生しました。再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ログイン済みの場合はダッシュボードにリダイレクト
  if (isAuthenticated) {
    navigate('/');
    return null;
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
        <Card className="w-full max-w-md relative">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              SwimTrack {isAdminLogin ? "管理者" : "一般"} ログイン
            </CardTitle>
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAdminLogin(!isAdminLogin);
                  setLoginError(null);
                  form.reset({
                    username: "",
                    password: ""
                  });
                }}
                className="mt-2"
              >
                {isAdminLogin ? (
                  <>
                    <User className="h-4 w-4 mr-2" />
                    一般ログインへ
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 mr-2" />
                    管理者ログインへ
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loginError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>エラー</AlertTitle>
                <AlertDescription>{loginError}</AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {isAdminLogin && (
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>管理者名</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            disabled={isSubmitting}
                            autoComplete="username"
                            className="bg-white"
                            placeholder="管理者名を入力"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
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
                          disabled={isSubmitting}
                          autoComplete="current-password"
                          className="bg-white"
                          placeholder={isAdminLogin ? "管理者パスワード" : "パスワードを入力"}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
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
          {!isAdminLogin && (
            <CardFooter className="flex flex-col space-y-2">
              <div className="text-sm text-gray-500 text-center">
                アカウントをお持ちでない方は
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/register")}
                disabled={isSubmitting}
              >
                新規登録
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
