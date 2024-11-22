import React, { useEffect } from 'react';
import { useToastStore, Toast } from '../../stores/toast';

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  useEffect(() => {
    toasts.forEach((toast) => {
      if (toast.duration) {
        const timer = setTimeout(() => {
          removeToast(toast.id);
        }, toast.duration);

        return () => clearTimeout(timer);
      }
    });
  }, [toasts, removeToast]);

  const getToastClasses = (type: Toast['type']) => {
    const baseClasses = 'p-4 rounded-md shadow-lg mb-2 transition-all duration-300';
    switch (type) {
      case 'success':
        return `${baseClasses} bg-green-100 text-green-800 border border-green-200`;
      case 'error':
        return `${baseClasses} bg-red-100 text-red-800 border border-red-200`;
      case 'warning':
        return `${baseClasses} bg-yellow-100 text-yellow-800 border border-yellow-200`;
      default:
        return `${baseClasses} bg-blue-100 text-blue-800 border border-blue-200`;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={getToastClasses(toast.type)}
          onClick={() => removeToast(toast.id)}
          role="alert"
        >
          <p>{toast.message}</p>
        </div>
      ))}
    </div>
  );
}
