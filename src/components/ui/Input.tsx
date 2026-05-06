import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  variant?: 'simple' | 'sketchy';
}

export const Input: React.FC<InputProps> = ({ 
  label, 
  helperText, 
  variant = 'sketchy', 
  className = '', 
  ...props 
}) => {
  if (variant === 'simple') {
    return (
      <div style={{ width: '100%', marginBottom: '16px' }}>
        {label && (
          <div className="label" style={{ fontSize: '9px', marginBottom: '4px' }}>
            {label}
          </div>
        )}
        <input 
          className={className}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--border-mid)',
            color: 'var(--text)',
            padding: '8px 4px',
            outline: 'none',
            width: '100%',
          }} 
          {...props} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-2 mb-6 w-full group">
      {label && (
        <label className="text-[10px] uppercase tracking-[0.2em] text-ink font-black opacity-40 group-focus-within:opacity-100 transition-opacity ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          className={`w-full bg-paper-dark/50 border-b-2 border-ink/10 outline-none px-4 py-4 text-ink font-sans transition-all placeholder:text-ink/20 focus:placeholder:text-transparent focus:border-sepia text-base opacity-60 focus:opacity-100 rounded-t-lg ${className}`}
          {...props}
        />
      </div>
      {helperText && (
        <p className="text-[10px] text-ink/30 ml-1 mt-1 font-bold tracking-tight uppercase">{helperText}</p>
      )}
    </div>
  );
};
