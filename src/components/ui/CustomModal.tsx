import React from 'react';

interface CustomModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'warning' | 'info';
}

export const CustomModal: React.FC<CustomModalProps> = ({ 
  isOpen, title, message, confirmText = 'Yes', cancelText = 'Cancel', onConfirm, onCancel, variant = 'warning' 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-paper/90 backdrop-blur-sm" onClick={onCancel} />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm border-2 border-ink bg-paper-dark rounded-[var(--radius-btn)] shadow-[8px_8px_0px_0px_var(--ink)] p-8 animate-scale-in">
        {/* Accent line */}
        <div 
          className="absolute top-0 left-8 right-8 h-0.5" 
          style={{ background: variant === 'warning' ? 'var(--rust)' : 'var(--forest)' }}
        />

        <h3 className="text-xl font-black text-ink mb-3">{title}</h3>
        <p className="text-sm text-ink/60 font-medium leading-relaxed mb-8">{message}</p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-[11px] uppercase tracking-widest font-black text-ink/40 border-2 border-ink/20 rounded-[var(--radius-btn)] hover:border-ink hover:text-ink transition-all duration-200"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 text-[11px] uppercase tracking-widest font-black text-paper border-2 rounded-[var(--radius-btn)] transition-all duration-200 hover:shadow-[4px_4px_0px_0px_var(--ink)] hover:-translate-x-0.5 hover:-translate-y-0.5"
            style={{ 
              background: variant === 'warning' ? 'var(--rust)' : 'var(--forest)',
              borderColor: variant === 'warning' ? 'var(--rust)' : 'var(--forest)'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
