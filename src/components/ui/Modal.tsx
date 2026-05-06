import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  actions?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth = "max-w-2xl",
  actions 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 sm:p-12">
      {/* Overlay - Semi-transparent with blur */}
      <div 
        className="absolute inset-0 bg-paper/60 backdrop-blur-md" 
        onClick={onClose}
      />
      
      {/* Modal Content - Solid Fill */}
      <div 
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto relative animate-scale-in sketchy-border`}
        style={{ backgroundColor: 'var(--paper)', opacity: 1 }} 
      >
        {/* Header */}
        {(title || actions) || true ? (
          <div className="flex justify-between items-center mb-8 sticky top-0 py-6 px-8 sm:px-12 z-50 border-b-2 border-ink/5" style={{ backgroundColor: 'var(--paper)' }}>
            {title && <h3 className="text-3xl font-black">{title}</h3>}
            <div className="flex gap-4 ml-auto">
              {actions}
              <button 
                onClick={onClose} 
                className="sketchy-btn px-4 py-2 hover:bg-rust hover:text-white hover:border-rust"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={20} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ) : null}

        {/* Body */}
        <div className="px-8 pb-8 sm:px-12 sm:pb-12 pt-4">
          {children}
        </div>
      </div>
    </div>
  );
};
