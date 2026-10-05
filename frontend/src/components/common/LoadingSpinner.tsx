import React from 'react';
import { clsx } from 'clsx';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', label }) => {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 gap-3">
      <div
        className={clsx(
          'animate-spin rounded-full border-t-transparent border-blue-600',
          sizes[size]
        )}
      />
      {label && <p className="text-xs text-slate-500 font-medium">{label}</p>}
    </div>
  );
};
