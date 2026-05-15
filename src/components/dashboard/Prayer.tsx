import React, { useState, useEffect } from 'react';
import { BackBtn } from '../layout/Common';
import { PageHeader } from '../ui/UIComponents';
import { WavyRing } from './Pomodoro';
import { usePrayer } from '../../hooks/usePrayer';

interface PrayerProps {
  navigate: (to: string) => void;
}

export const Prayer: React.FC<PrayerProps> = ({ navigate }) => {
  const { times, nextPrayer, loading, hijri } = usePrayer();
  const [phase, setPhase] = useState(0);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let animId: number;
    const animate = () => {
      setPhase(p => (p + 0.05) % (Math.PI * 2));
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getStatus = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const pDate = new Date(now);
    pDate.setHours(h, m, 0, 0);
    const diffMins = (now.getTime() - pDate.getTime()) / 60000;
    if (diffMins >= 0 && diffMins <= 15) return 'active';
    if (diffMins >= -15 && diffMins < 0) return 'upcoming';
    return diffMins < 0 ? 'pending' : 'passed';
  };

  const formatTo12h = (time24: string) => {
    let [h, m] = time24.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
  };

  const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  const statusColors: Record<string, string> = { 
    active: 'text-[var(--forest)]', 
    upcoming: 'text-[var(--forest)]', 
    pending: 'text-ink/60', 
    passed: 'text-ink/10' 
  };

  const showTimer = nextPrayer && (nextPrayer as any).remainingMinutes <= 15;

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-12 px-4 sm:px-6 min-h-screen">
      <BackBtn onClick={()=>navigate('home')} />
      
      <PageHeader 
        title="Prayer" 
        subtitle="Mansoura, Egypt" 
        className="[&>h2]:text-5xl sm:[&>h2]:text-6xl"
      />
      
      {showTimer && nextPrayer && (
        <div className="sys-card p-6 sm:p-12 text-center mb-8 sm:mb-12 border-l-4 sm:border-l-8 border-l-forest bg-forest/5">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.4em] font-black mb-8 sm:mb-12 text-forest">
            Up Next: {nextPrayer.name} ({nextPrayer.time})
          </div>
          <div className="relative w-full max-w-[320px] aspect-square mx-auto flex items-center justify-center">
            <WavyRing 
              pct={Math.max(0, Math.min(100, ((nextPrayer as any).totalRemainingSeconds / (15 * 60)) * 100))} 
              phase={phase} 
              mode="focus" 
              isOvertime={false} 
              size={320} 
              waves={16} 
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none translate-y-1">
              <span className="text-4xl sm:text-[54px] font-black text-ink tabular-nums leading-none">{nextPrayer.countdown}</span>
              <span className="text-[9px] tracking-[0.2em] sm:tracking-[0.4em] font-black text-ink/30 uppercase mt-3 sm:mt-5">Remaining</span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h3 className="text-[10px] uppercase font-black tracking-[0.3em] text-ink/20 mb-4">Prayer Schedule</h3>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-12">
        {loading ? (
          <div className="sys-card py-24 text-center text-ink/20 font-black uppercase tracking-widest text-sm animate-pulse">Syncing...</div>
        ) : prayerNames.map(name => {
          const time = times[name];
          if (!time) return null;
          const status = getStatus(time);
          const isActive = status === 'active';
          
          return (
            <div key={name} className={`sys-card p-6 sm:p-12 flex flex-col sm:flex-row justify-between items-start sm:items-center transition-all duration-500 ${isActive ? 'border-l-4 sm:border-l-8 border-l-forest bg-forest/5 scale-100 sm:scale-[1.02]' : 'opacity-80'}`}>
              <div className="flex-1">
                 <div className={`text-3xl sm:text-4xl font-black tracking-tighter ${statusColors[status]}`}>
                    {name}
                 </div>
                 <div className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-2 ${isActive ? 'text-forest' : 'text-ink/20'}`}>
                    {isActive ? 'Current Phase' : status}
                 </div>
              </div>
              <div className="text-left sm:text-right flex-1 mt-4 sm:mt-0">
                 <div className={`text-4xl sm:text-5xl font-black tracking-tighter ${statusColors[status]}`}>{formatTo12h(time)}</div>
                 {isActive && (
                    <div className="text-[10px] sm:text-xs font-black text-forest uppercase tracking-widest mt-1 sm:mt-2">Active now</div>
                 )}
              </div>
            </div>
          );
        })}
      </div>

      {hijri && (
        <div className="text-center pb-12">
          <p className="text-[10px] font-black text-forest/30 uppercase tracking-[0.5em] mb-2">Hijri Date</p>
          <p className="text-xl font-black text-sepia tracking-tight">{hijri}</p>
        </div>
      )}
    </div>
  );
};
