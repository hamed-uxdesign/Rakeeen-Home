import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft02Icon } from '@hugeicons/core-free-icons';

export const BackBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button 
    onClick={onClick} 
    className="flex items-center gap-2 px-0 py-2 text-ink/40 hover:text-sepia transition-all group mb-8"
  >
    <HugeiconsIcon 
      icon={ArrowLeft02Icon} 
      size={18} 
      strokeWidth={2} 
      className="transition-transform group-hover:-translate-x-1" 
    />
    <span className="text-[10px] uppercase font-black tracking-[0.2em]">Go Back</span>
  </button>
);
