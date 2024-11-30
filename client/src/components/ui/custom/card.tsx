import React from 'react';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className = '', children }: CardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children }: CardProps) {
  return (
    <div className={`p-6 pb-3 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children }: CardProps) {
  return (
    <h3 className={`text-xl font-semibold ${className}`}>
      {children}
    </h3>
  );
}

export function CardContent({ className = '', children }: CardProps) {
  return (
    <div className={`p-6 pt-3 ${className}`}>
      {children}
    </div>
  );
}
