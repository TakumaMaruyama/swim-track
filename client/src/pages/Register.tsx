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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "../hooks/use-user";
import { insertUserSchema } from "db/schema";
import { Loader2, Home } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function Register() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { register, isLoading: authLoading, isAuthenticated } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      console.log('[Register] User is already authenticated, redirecting');
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      role: "student",
    },
    mode: "onChange",
  });

  const { formState } = form;

  async function onSubmit(values: { username: string; password: string; role: string }) {
    try {
      console.log('[Register] Starting registration');
      setIsSubmitting(true);
      const result = await register(values);
      
      if (result.ok) {
        console.log('[Register] Registration successful');
        toast({
          title: "登録成功",
          description: "ログインページに移動します",
        });
        navigate("/login");
      } else {
        console.log('[Register] Registration failed:', result.message);
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            form.setError(field as "username" | "password" | "role", {
              type: "manual",
              message: messages[0],
            });
          });
        } else if (result.field === "username") {
          form.setError("username", {
            type: "manual",
            message: result.message,
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
      console.error('[Register] Unexpected error:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "予期せぬエラーが発生しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">認証状態を確認中...</p>
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
              SwimTrack アカウント作成
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
                        <Input 
                          {...field} 
                          disabled={isSubmitting}
                          autoComplete="username"
                          className="bg-white"
                        />
                      </FormControl>
                      <FormDescription>
                        ユーザー名は2文字以上で入力してください
                      </FormDescription>
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
                          disabled={isSubmitting}
                          autoComplete="new-password"
                          className="bg-white"
                        />
                      </FormControl>
                      <FormDescription>
                        パスワードは8文字以上で入力してください
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>アカウントタイプ</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="アカウントタイプを選択" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="student">選手</SelectItem>
                          <SelectItem value="coach">コーチ</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {formState.errors.root && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {formState.errors.root.message}
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      登録中...
                    </>
                  ) : (
                    "登録"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <div className="text-sm text-gray-500 text-center">
              すでにアカウントをお持ちの方は
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/login")}
              disabled={isSubmitting}
            >
              ログインへ戻る
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
