import React from 'react';

export interface BottomSheetProps {
  title?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function BottomSheet({ title, open, onClose, children }: BottomSheetProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full bg-[var(--color-background-primary)] px-5 pt-4 pb-10 h-[95vh] overflow-y-auto rounded-t-[32px]"
        style={{ 
          boxShadow: 'var(--shadow-bottom-sheet)' 
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-[var(--border-default)] mx-auto mb-4" />
        {title && <h3 className="text-[17px] font-bold text-[var(--color-text-primary)] text-center mb-2">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
