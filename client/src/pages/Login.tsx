import { useEffect } from 'react';
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Home, AlertCircle } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { useUser } from "../hooks/use-user";
import { LogLevel } from "../types/auth";

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
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardFooter 
} from "@/components/ui/card";
import { 
  Alert, 
  AlertDescription 
} from "@/components/ui/alert";

import { insertUserSchema } from "db/schema";
import type { z } from "zod";

/** Login form values type */
type LoginFormValues = z.infer<typeof insertUserSchema>;

/**
 * Structured logging function with filtered output
 * Only logs critical events and errors
 */
/**
 * Structured logging function for login operations
 * Only logs critical login events and errors
 *
 * @param level - Log level (ERROR, WARN, INFO)
 * @param operation - Operation being performed
 * @param message - Log message
 * @param context - Additional context data
 */
function logLogin(level: LogLevel, operation: string, message: string, context?: Record<string, unknown>): void {
  // Only log errors and critical state changes
  const shouldLog = 
    level === LogLevel.ERROR || 
    (level === LogLevel.INFO && context?.critical === true);

  if (shouldLog) {
    console.log({
      timestamp: new Date().toISOString(),
      system: 'Login',
      level,
      operation,
      message,
      ...(level === LogLevel.ERROR || context?.critical ? { context } : {})
    });
  }
}

/**
 * Login Page Component
 * Handles user authentication and login functionality
 */
export default function Login(): JSX.Element {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { 
    login, 
    isAuthenticated, 
    isAuthChecking,
    error: authError 
  } = useUser();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Handle redirect on successful authentication
  useEffect(() => {
    if (!isAuthChecking && isAuthenticated) {
      logLogin(LogLevel.INFO, 'navigation', 'Redirecting authenticated user', { critical: true });
      window.location.replace('/');
    }
  }, [isAuthChecking, isAuthenticated]);

  /**
   * Handles form submission for login
   * @param values - Form values containing username and password
   */
  const onSubmit = async (values: LoginFormValues): Promise<void> => {
    try {
      const result = await login(values);
      
      if (result.ok) {
        toast({
          title: "ログイン成功",
          description: "ダッシュボードに移動します",
        });
        window.location.replace('/');
        return;
      }

      // Handle validation errors
      if (result.errors) {
        Object.entries(result.errors).forEach(([field, messages]) => {
          form.setError(field as keyof LoginFormValues, {
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
    } catch (error) {
      logLogin(LogLevel.ERROR, 'login_error', 'Login failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      toast({
        variant: "destructive",
        title: "エラー",
        description: "予期せぬエラーが発生しました",
      });
    }
  };

  // Show loading state during authentication check
  if (isAuthChecking) {
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
