import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'terra' | 'premium' | 'sketchy';
  fullWidth?: boolean;
  filled?: boolean; // For sketchy variant
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false,
  filled = false,
  className = '', 
  style,
  ...props 
}) => {
  let baseClass = '';
  
  if (variant === 'sketchy') {
    baseClass = `sketchy-btn ${filled ? 'filled' : ''}`;
  } else {
    baseClass = variant === 'premium' ? 'btn-premium' : `btn-${variant}`;
  }

  const widthStyle = fullWidth ? { width: '100%' } : {};

  return (
    <button 
      className={`${baseClass} ${className}`}
      style={{ ...widthStyle, ...style }}
      {...props}
    >
      {children}
    </button>
  );
};
