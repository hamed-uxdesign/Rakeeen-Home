import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const BrutalistButton: React.FC<ButtonProps> = ({ children, className = '', ...props }) => {
  return (
    <button 
      className={`btn-brutalist ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
