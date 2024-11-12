import React from 'react';
import { useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Home } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  const [, navigate] = useLocation();

  return (
    <div className="container py-8 px-4 md:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/')}
            className="shrink-0"
          >
            <Home className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
        </div>
        {children && (
          <div className="w-full sm:w-auto">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
