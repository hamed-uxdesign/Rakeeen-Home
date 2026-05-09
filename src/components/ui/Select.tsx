import React, { useState, useRef, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export const CustomSelect: React.FC<SelectProps> = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select...", 
  label,
  className = "" 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-[10px] tracking-[0.2em] text-ink font-black opacity-40 mb-2 block ml-1 uppercase">
          {label}
        </label>
      )}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-paper p-4 rounded-none text-sm font-bold border-2 transition-all cursor-pointer flex justify-between items-center ${
          isOpen ? 'border-forest' : 'border-transparent hover:border-ink/20'
        }`}
      >
        <span className={!selectedOption ? 'text-ink/30' : 'text-ink'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <HugeiconsIcon 
          icon={ArrowDown01Icon} 
          size={18} 
          className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-forest' : 'text-ink/40'}`} 
        />
      </div>

      {isOpen && (
        <div 
          className="absolute z-[9999] mt-2 w-full border-2 border-forest rounded-none overflow-hidden shadow-2xl animate-scale-in"
          style={{ backgroundColor: 'var(--paper)', opacity: 1 }}
        >
          <div className="max-h-[200px] overflow-y-auto no-scrollbar" style={{ backgroundColor: 'var(--paper)' }}>
            {options.map((opt) => (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`p-4 text-sm font-bold cursor-pointer transition-colors ${
                  value === opt.value ? 'bg-sepia text-paper' : 'text-ink hover:bg-sepia/10'
                }`}
              >
                {opt.label}
              </div>
            ))}
            {options.length === 0 && (
              <div className="p-4 text-xs text-ink/30 italic text-center">No options available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
