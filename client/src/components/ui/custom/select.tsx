import React from 'react';

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
}

export function Select({ 
  value, 
  onValueChange, 
  children, 
  className = '' 
}: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={`w-full px-3 py-2 border rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${className}`}
    >
      {children}
    </select>
  );
}

export function SelectItem({ value, children }: SelectItemProps) {
  return (
    <option value={value}>{children}</option>
  );
}

export function SelectTrigger({ className = '', children }: { className?: string, children: React.ReactNode }) {
  return (
    <div className={`relative ${className}`}>
      {children}
    </div>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return <span>{placeholder}</span>;
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
