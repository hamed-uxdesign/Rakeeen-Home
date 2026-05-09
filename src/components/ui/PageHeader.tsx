import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  className?: string;
  size?: 'md' | 'lg';
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, className = '', size = 'lg' }) => {
  return (
    <header className={size === 'lg' ? `mb-12 ${className}` : `mb-10 ${className}`}>
      <h2 className={`font-black text-ink tracking-tighter ${size === 'lg' ? 'text-5xl mb-2' : 'text-4xl mb-1'}`}>
        {title}
      </h2>
      <p className={`font-black uppercase text-ink/30 ${size === 'lg' ? 'text-xs tracking-[0.3em]' : 'text-[10px] tracking-[0.2em]'}`}>
        {subtitle}
      </p>
    </header>
  );
};
