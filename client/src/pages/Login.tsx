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
import { useState } from "react";

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { login, isAuthenticated } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  
  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "general_user",
      password: "",
    },
  });

  async function onSubmit(values: { username: string; password: string }) {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Add isAdminLogin flag to the request
      const loginData = {
        ...values,
        isAdminLogin: isAdminLogin
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
      if (result.errors) {
        Object.entries(result.errors).forEach(([field, messages]) => {
          form.setError(field as "username" | "password", {
            type: "manual",
            message: messages[0],
          });
        });
        return;
      }

      // Handle credential errors
      if (result.field === "credentials") {
        form.setError("password", {
          type: "manual",
          message: result.message,
        });
        return;
      }

      // Handle other errors
      toast({
        variant: "destructive",
        title: "認証エラー",
        description: result.message,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "認証中にエラーが発生しました。再度お試しください。",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // If already authenticated, redirect to dashboard
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsAdminLogin(!isAdminLogin);
              form.reset({
                username: !isAdminLogin ? "丸山拓真" : "general_user",
                password: ""
              });
            }}
            className="absolute right-4 top-4"
          >
            {isAdminLogin ? "一般ログインへ" : "管理者ログインへ"}
          </Button>
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              SwimTrack ログイン
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {isAdminLogin ? (
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
                            value="丸山拓真"
                            readOnly
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
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
                          placeholder={isAdminLogin ? "管理者パスワード" : "一般利用者パスワード"}
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
