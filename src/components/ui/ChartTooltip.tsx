import React from 'react';

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  unit: string;
  getTipMessage: (value: number) => string;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label, unit, getTipMessage }) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      <div 
        className="border-2 border-ink shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] p-6 rounded-none animate-scale-in"
        style={{ backgroundColor: 'var(--paper)', opacity: 1 }}
      >
        <p className="text-ink font-black text-3xl mb-1">{label}</p>
        <p className="text-forest font-black text-xl">{val} {unit}</p>
        <p className="text-[10px] text-ink/40 uppercase tracking-[0.3em] mt-4 font-black">
          {getTipMessage(val)}
        </p>
      </div>
    );
  }
  return null;
};
