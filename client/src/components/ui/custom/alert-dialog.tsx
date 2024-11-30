import React from 'react';

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function AlertDialog({ 
  isOpen, 
  onClose, 
  title, 
  description, 
  children 
}: AlertDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        {description && (
          <p className="text-gray-600 mb-4">{description}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          {children}
        </div>
      </div>
    </div>
  );
}

interface AlertProps {
  variant?: 'default' | 'destructive';
  children: React.ReactNode;
}

export function Alert({ variant = 'default', children }: AlertProps) {
  const baseClasses = "p-4 rounded-lg mb-4";
  const variantClasses = {
    default: "bg-blue-50 text-blue-700",
    destructive: "bg-red-50 text-red-700"
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </div>
  );
}

export function AlertDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm">{children}</p>;
}
