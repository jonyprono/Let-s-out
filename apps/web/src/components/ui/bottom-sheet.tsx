import React from 'react';

export interface BottomSheetProps {
  title?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  noPadding?: boolean;
  className?: string;
}

export function BottomSheet({ title, open, onClose, children, noPadding, className }: BottomSheetProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className={`relative w-full bg-[var(--color-background-primary)] max-h-[95vh] flex flex-col rounded-t-[32px] ${noPadding ? '' : 'px-5 pt-4 pb-10'} ${className || ''}`}
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
