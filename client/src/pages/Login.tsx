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
import { useEffect, useCallback, useRef } from "react";

const FORCE_NAVIGATION_TIMEOUT = 3000; // 3 seconds

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { 
    login, 
    isAuthenticated, 
    isLoading: isAuthChecking, 
    isNavigating,
    navigationSuccess,
    error: authError 
  } = useUser();

  const navigationTimeoutRef = useRef<NodeJS.Timeout>();
  
  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Force navigation after timeout
  const forceNavigation = useCallback(() => {
    console.log('[Login] Forcing navigation to dashboard');
    navigate("/", { replace: true });
  }, [navigate]);

  // Handle navigation after authentication
  const handleNavigation = useCallback(() => {
    if (isAuthenticated && !isNavigating) {
      console.log('[Login] User authenticated, setting up forced navigation');
      
      // Clear any existing timeout
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }

      // Set up new forced navigation timeout
      navigationTimeoutRef.current = setTimeout(() => {
        forceNavigation();
      }, FORCE_NAVIGATION_TIMEOUT);

      // Attempt immediate navigation
      navigate("/");
    }
  }, [isAuthenticated, isNavigating, navigate, forceNavigation]);

  // Monitor navigation success
  useEffect(() => {
    console.log('[Login] Navigation state updated:', { 
      isAuthenticated, 
      isNavigating, 
      navigationSuccess 
    });

    if (navigationSuccess) {
      console.log('[Login] Navigation successful, forcing redirect');
      forceNavigation();
    }
  }, [navigationSuccess, forceNavigation]);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isAuthChecking) {
      handleNavigation();
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, [isAuthenticated, isAuthChecking, handleNavigation]);

  async function onSubmit(values: { username: string; password: string }) {
    try {
      console.log('[Login] Attempting login');
      const result = await login(values);
      
      if (result.ok) {
        toast({
          title: "ログイン成功",
          description: "ダッシュボードに移動します",
        });
        handleNavigation();
      } else {
        console.log('[Login] Login failed:', result.message);
        if (result.errors) {
          // Set form errors if we have field-specific errors
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
          disabled={isNavigating}
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
                          disabled={form.formState.isSubmitting || isNavigating}
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
                          disabled={form.formState.isSubmitting || isNavigating}
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
                  disabled={form.formState.isSubmitting || isNavigating}
                >
                  {form.formState.isSubmitting || isNavigating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isNavigating ? "移動中..." : "ログイン中..."}
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
              disabled={form.formState.isSubmitting || isNavigating}
            >
              新規登録
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
