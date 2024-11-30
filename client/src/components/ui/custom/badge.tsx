import React from 'react';

interface BadgeProps {
  variant?: 'default' | 'secondary' | 'outline';
  className?: string;
  children: React.ReactNode;
}

export function Badge({ 
  variant = 'default', 
  className = '', 
  children 
}: BadgeProps) {
  const baseClasses = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";
  const variantClasses = {
    default: "bg-primary text-white",
    secondary: "bg-gray-100 text-gray-900",
    outline: "border border-gray-200 text-gray-900"
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
