import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  variant?: 'simple' | 'sketchy';
  headerAction?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ 
  title, 
  subtitle, 
  variant = 'sketchy', 
  headerAction,
  children, 
  className = '', 
  style, 
  ...props 
}) => {
  if (variant === 'simple') {
    return (
      <div 
        className={`card ${className}`}
        style={{ ...style }}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div 
      className={`bg-paper-dark sketchy-border p-8 relative transition-all duration-300 ${className}`}
      style={style}
      {...props}
    >
      {(title || subtitle) && (
        <div className="mb-8 flex justify-between items-start">
          <div>
            {title && (
              <h2 className="text-3xl font-bold tracking-tight mb-1">{title}</h2>
            )}
            {subtitle && (
              <p className="text-[10px] uppercase tracking-widest text-ink opacity-40 font-bold">{subtitle}</p>
            )}
          </div>
          {headerAction && (
             <div className="flex-shrink-0 ml-4">
                {headerAction}
             </div>
          )}
        </div>
      )}
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};
