import React, { useState, useEffect } from 'react';
import { MOCK_PRAYER_TIMES } from '../../constants/mockData';
import { BackBtn } from '../layout/Common';
import { HugeiconsIcon } from '@hugeicons/react';
import { RefreshIcon } from '@hugeicons/core-free-icons';

interface PrayerProps {
  navigate: (to: string) => void;
}

export const Prayer: React.FC<PrayerProps> = ({ navigate }) => {
  const [times, setTimes] = useState(MOCK_PRAYER_TIMES);
  const [loading, setLoading] = useState(false);

  const mockFetch = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setTimes(MOCK_PRAYER_TIMES);
    setLoading(false);
  };

  useEffect(() => { mockFetch(); }, []);

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const getStatus = (prayerTime: string, nextTime?: string) => {
    if (currentTime >= prayerTime && (!nextTime || currentTime < nextTime)) return 'current';
    if (currentTime < prayerTime) return 'upcoming';
    return 'passed';
  };

  const prayerEntries = Object.entries(times);
  const statusColors: Record<string, string> = { current: 'text-sepia', upcoming: 'text-ink/80', passed: 'text-ink/30' };

  return (
    <div className="max-w-xl mx-auto py-10 px-5">
      <BackBtn onClick={()=>navigate('home')} />
      
      <header className="mb-8">
        <h2 className="text-4xl font-black text-ink mb-2">Prayer times</h2>
        <p className="text-[10px] text-ink/50 tracking-[0.2em] font-black">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </header>
      
      <div className="flex items-center gap-4 text-[10px] text-ink/30 font-mono mb-10 font-bold tracking-widest">
        <span>// Aladhan API · Cairo</span>
        <button 
          onClick={mockFetch} 
          className="flex items-center gap-1 text-sepia/60 hover:text-sepia transition-colors"
        >
          <HugeiconsIcon icon={RefreshIcon} size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {prayerEntries.map(([name, time], i) => {
          const nextTime = prayerEntries[i+1]?.[1];
          const status = getStatus(time, nextTime);
          const isCurrent = status === 'current';
          
          return (
            <div key={name} 
              className={`flex justify-between items-center px-8 py-6 transition-all duration-300
                ${isCurrent ? 'bg-sepia/10 sketchy-border scale-[1.02] -translate-y-1' : 'bg-[var(--paper)] border-2 border-ink/5 rounded-2xl hover:border-ink/10'}
              `}
            >
              <div className="flex items-center gap-4">
                {isCurrent && <div className="w-2 h-2 rounded-full bg-sepia shadow-[0_0_10px_var(--sepia)] animate-pulse" />}
                {!isCurrent && <div className="w-2" />}
                <div>
                  <div className={`text-2xl font-bold ${statusColors[status]}`}>{name}</div>
                  {isCurrent && <div className="text-[9px] tracking-[0.2em] font-black text-sepia/70 mt-1">Active now</div>}
                </div>
              </div>
              <div className={`text-4xl font-black ${statusColors[status]}`}>{time}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 text-center text-xs text-ink/30 font-mono font-bold tracking-widest">
        ١٤٤٦ هـ · Calculating Hijri date...
      </div>
    </div>
  );
};
