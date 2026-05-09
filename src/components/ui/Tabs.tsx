import React from 'react';

interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: (string | TabItem)[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className = '', size = 'sm' }) => {
  return (
    <div className={`flex gap-3 relative z-10 ${className}`}>
      {tabs.map(t => {
        const id = typeof t === 'string' ? t : t.id;
        const label = typeof t === 'string' ? t : t.label;
        const isActive = activeTab === id;
        
        return (
          <button 
            key={id} 
            onClick={() => onChange(id)}
            className={`
              uppercase font-black border-2 transition-all duration-300
              ${size === 'sm' ? 'text-[10px] tracking-widest px-6 py-3' : 'text-[11px] tracking-[0.2em] px-6 py-3'}
              ${isActive 
                ? 'border-transparent opacity-100' 
                : 'bg-transparent text-ink border-ink opacity-30 hover:opacity-100 hover:border-forest hover:bg-forest/10'
              }
            `}
            style={isActive ? { backgroundColor: 'var(--forest)', color: 'var(--paper)' } : {}}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
