import React, { useEffect } from 'react';

export interface BottomSheetProps {
  title?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  noPadding?: boolean;
  className?: string;
}

export function BottomSheet({ title, open, onClose, children, noPadding, className }: BottomSheetProps) {
  useEffect(() => {
    if (open) {
      // Push state to history so the hardware back button will consume this state instead of navigating away
      window.history.pushState({ bottomSheet: true }, '');
      
      const handlePopState = () => {
        // PopState doesn't need preventDefault
        onClose();
      };
      
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
        // If closed by other means (like clicking backdrop), remove the state we pushed
        if (window.history.state?.bottomSheet) {
          window.history.back();
        }
      };
    }
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div
        className={`relative w-full max-w-[600px] bg-[var(--color-background-primary)] max-h-[95vh] flex flex-col rounded-t-[32px] ${noPadding ? '' : 'px-5 pt-4 pb-10'} ${className || ''} animate-in slide-in-from-bottom-full duration-300`}
        style={{ 
          boxShadow: 'var(--shadow-bottom-sheet)' 
        }}
        onClick={e => e.stopPropagation()}
      >
        {!noPadding && <div className="w-10 h-1 rounded-full bg-[var(--border-default)] mx-auto mb-4 flex-none" />}
        {title && <h3 className="text-[17px] font-bold text-[var(--color-text-primary)] text-center mb-2 flex-none">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
