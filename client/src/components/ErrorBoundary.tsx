import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export const ErrorBoundaryContext = React.createContext<{
  setError: (error: Error) => void;
} | null>(null);

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = React.useState<Error | null>(null);
  
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          エラーが発生しました。再度お試しください。
          {error.message}
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <ErrorBoundaryContext.Provider value={{ setError }}>
      {children}
    </ErrorBoundaryContext.Provider>
  );
}
