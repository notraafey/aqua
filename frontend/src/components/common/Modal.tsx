import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button.js';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, maxWidth }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className={twMerge(clsx('bg-white border border-slate-200/90 rounded-2xl w-full shadow-2xl overflow-hidden animate-scale-in', maxWidth || 'max-w-lg'))}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 max-h-[75vh] overflow-y-auto text-slate-800">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50/80 border-t border-slate-100">
            {footer}
          </div>
        ) : (
          <div className="flex items-center justify-end px-6 py-4 bg-slate-50/80 border-t border-slate-100">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
