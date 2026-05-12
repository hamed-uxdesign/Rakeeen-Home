

// Re-exporting unified components
export * from './Button';
export * from './Card';
export * from './Input';
export * from './Modal';
export * from './Select';
export * from './PageHeader';
export * from './ChartTooltip';

// --- TYPOGRAPHY & LABELS ---
export const Heading = ({ children, className = '', style }: any) => (
  <h2 className={`serif-heading ${className}`} style={{ fontSize: '28px', ...style }}>
    {children}
  </h2>
);

export const Label = ({ children, className = '', style }: any) => (
  <div className={`label ${className}`} style={{ ...style }}>
    {children}
  </div>
);
