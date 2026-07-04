import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  maxWidth?: string;
  /** Skip the content wrapper padding — use when children manage their own layout */
  raw?: boolean;
  /** Confirm-dialog mode: shows two action buttons instead of ESC */
  confirm?: {
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    variant?: 'warning' | 'info';
  };
}

export const AppModal: React.FC<AppModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
  raw = false,
  confirm,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="app-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-5"
          style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(18px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.93, opacity: 0, y: 18 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            onClick={e => e.stopPropagation()}
            className={`relative w-full ${maxWidth}`}
            style={{
              background: 'color-mix(in srgb, var(--paper-dark) 94%, transparent)',
              border: '1px solid color-mix(in srgb, var(--ink) 12%, transparent)',
            }}
          >
            {/* Header */}
            {(title || !confirm) && (
              <div
                className="flex items-center justify-between px-8 pt-8 pb-7"
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
              >
                {title && (
                  <span
                    className="font-sans-main font-black uppercase tracking-wide"
                    style={{ fontSize: 13, color: 'var(--ink)' }}
                  >
                    {title}
                  </span>
                )}
                <button
                  onClick={onClose}
                  className="ml-auto font-mono-main text-[10px] tracking-[0.2em] transition-opacity"
                  style={{ color: 'color-mix(in srgb, var(--ink) 35%, transparent)' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                >
                  ESC
                </button>
              </div>
            )}

            {/* Confirm mode */}
            {confirm ? (
              <div className="px-8 py-8">
                {title && (
                  <p
                    className="font-sans-main font-black uppercase tracking-wide mb-3"
                    style={{ fontSize: 14, color: 'var(--ink)' }}
                  >
                    {title}
                  </p>
                )}
                <p
                  className="font-mono-main leading-relaxed mb-8"
                  style={{ fontSize: 12, color: 'color-mix(in srgb, var(--ink) 55%, transparent)' }}
                >
                  {confirm.message}
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={onClose}
                    className="font-mono-main text-[10px] uppercase tracking-widest px-5 py-2.5 transition-opacity"
                    style={{
                      border: '1px solid color-mix(in srgb, var(--ink) 18%, transparent)',
                      color: 'color-mix(in srgb, var(--ink) 45%, transparent)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                  >
                    {confirm.cancelText ?? 'Cancel'}
                  </button>
                  <button
                    onClick={() => { confirm.onConfirm(); onClose(); }}
                    className="font-mono-main text-[10px] uppercase tracking-widest px-5 py-2.5 transition-opacity"
                    style={{
                      background: confirm.variant === 'info' ? 'color-mix(in srgb, var(--forest) 80%, transparent)' : 'color-mix(in srgb, var(--rust) 80%, transparent)',
                      color: 'var(--paper)',
                      border: 'none',
                    }}
                  >
                    {confirm.confirmText ?? 'Confirm'}
                  </button>
                </div>
              </div>
            ) : raw ? (
              <>{children}</>
            ) : (
              /* Content mode */
              <div className="px-8 pb-8 pt-6">{children}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
