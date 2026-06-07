import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { WavyRing } from './Pomodoro';
import { usePrayer } from '../../hooks/usePrayer';
import { quranRadioManager } from '../../utils/quranRadioManager';

interface PrayerProps {
  navigate: (to: string) => void;
}

export const Prayer: React.FC<PrayerProps> = ({ navigate }) => {
  const { times, nextPrayer, loading, hijri } = usePrayer();
  const [phase, setPhase] = useState(0);
  const [now, setNow] = useState(new Date());
  
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const unsubscribe = quranRadioManager.subscribe((playing) => {
      setIsPlaying(playing);
    });
    return () => unsubscribe();
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      quranRadioManager.pause();
    } else {
      quranRadioManager.play();
    }
  };

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
    <div className="min-h-screen bg-bg text-ink py-12 px-6 md:px-12 lg:px-20 font-sans-main flex flex-col transition-colors duration-300">
      
      {/* HEADER */}
      <header className="w-full max-w-[1000px] mx-auto mb-12">
        {/* Breadcrumb / Back */}
        <div className="flex items-center gap-2 mb-8">
          <button
            onClick={() => navigate('home')}
            className="flex items-center gap-2 text-ink/40 hover:text-ink transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-mono-main text-[10px] uppercase tracking-[0.25em] font-bold">Home</span>
          </button>
          <ChevronRight size={12} className="text-ink/20" />
          <span className="font-mono-main text-[10px] uppercase tracking-[0.25em] font-bold text-ink/50">Prayer</span>
        </div>

        <div className="flex flex-col">
          <h1 className="font-sans-main text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-ink">
            PRAYER TIMES
          </h1>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="w-full max-w-[1000px] mx-auto flex flex-col gap-6">

        {showTimer && nextPrayer && (
          <div className="brutalist-card no-lift p-6 sm:p-8 text-center border-l-4 border-l-forest bg-forest/5">
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.25em] font-black mb-8 text-forest">
              Up Next: {nextPrayer.name} ({nextPrayer.time})
            </div>
            <div className="relative w-full max-w-[280px] aspect-square mx-auto flex items-center justify-center">
              <WavyRing 
                pct={Math.max(0, Math.min(100, ((nextPrayer as any).totalRemainingSeconds / (15 * 60)) * 100))} 
                phase={phase} 
                mode="focus" 
                isOvertime={false} 
                size={280} 
                waves={16} 
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none translate-y-1">
                <span className="text-4xl font-black text-ink tabular-nums leading-none">{nextPrayer.countdown}</span>
                <span className="text-[9px] tracking-[0.2em] font-black text-ink/30 uppercase mt-3">Remaining</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            {loading ? (
              <div className="py-12 text-center text-ink/20 font-black uppercase tracking-widest text-sm animate-pulse">Syncing...</div>
            ) : (
              <>
                {prayerNames.map(name => {
                  const time = times[name];
                  if (!time) return null;
                  const status = getStatus(time);
                  const isActive = status === 'active';
                  
                  return (
                    <div 
                      key={name} 
                      className={`p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center transition-all duration-300 border border-ink ${isActive ? 'border-l-4 border-l-forest bg-forest/5' : 'bg-paper-dark'}`}
                    >
                      <div className="flex-1">
                         <div className={`text-3xl font-black tracking-tighter ${statusColors[status]}`}>
                            {name}
                         </div>
                         <div className={`text-[10px] font-black uppercase tracking-[0.2em] mt-1 ${isActive ? 'text-forest' : 'text-ink/20'}`}>
                            {isActive ? 'Current Phase' : status}
                         </div>
                      </div>
                      <div className="text-left sm:text-right flex-1 mt-3 sm:mt-0">
                         <div className={`text-4xl font-black tracking-tighter ${statusColors[status]}`}>{formatTo12h(time)}</div>
                         {isActive && (
                            <div className="text-[10px] font-black text-forest uppercase tracking-widest mt-1">Active now</div>
                         )}
                      </div>
                    </div>
                  );
                })}

                {/* Quran Radio Card */}
                <div className={`p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center transition-all duration-300 border border-ink ${isPlaying ? 'border-l-4 border-l-sepia bg-sepia/5' : 'bg-paper-dark'}`}>
                  <div className="flex-1">
                     <div lang="ar" className="font-arabic-main text-3xl font-black tracking-tighter text-ink">
                        إذاعة القرآن الكريم
                     </div>
                  </div>
                  <div className="text-left sm:text-right flex items-center gap-4 mt-3 sm:mt-0">
                     {isPlaying && (
                        <div className="flex items-end gap-0.5 h-4 w-8 pr-2">
                           <span className="w-0.5 bg-sepia animate-[pulseWave_0.8s_infinite_ease-in-out_alternate]" style={{ height: '30%' }} />
                           <span className="w-0.5 bg-sepia animate-[pulseWave_1.2s_infinite_ease-in-out_alternate_0.2s]" style={{ height: '50%' }} />
                           <span className="w-0.5 bg-sepia animate-[pulseWave_0.9s_infinite_ease-in-out_alternate_0.4s]" style={{ height: '70%' }} />
                           <span className="w-0.5 bg-sepia animate-[pulseWave_1.1s_infinite_ease-in-out_alternate_0.1s]" style={{ height: '40%' }} />
                        </div>
                     )}
                     <button
                        onClick={togglePlay}
                        className="btn-brutalist px-6 py-2.5 text-xs font-mono-main cursor-pointer"
                     >
                        {isPlaying ? 'PAUSE' : 'PLAY LIVE'}
                      </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {hijri && (
          <div className="text-center pb-12 mt-6">
            <p className="text-[10px] font-black text-forest/30 uppercase tracking-[0.5em] mb-2">Hijri Date</p>
            <p lang="ar" className="font-arabic-main text-xl font-black text-sepia tracking-tight">{hijri}</p>
          </div>
        )}

      </main>
    </div>
  );
};
