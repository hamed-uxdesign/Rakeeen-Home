import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { WavyRing } from './Pomodoro';
import { usePrayer } from '../../hooks/usePrayer';
import { quranRadioManager } from '../../utils/quranRadioManager';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';


interface PrayerProps {
  navigate: (to: string) => void;
}

export const Prayer: React.FC<PrayerProps> = ({ navigate }) => {
  const { times, nextPrayer, loading, hijri } = usePrayer();
  const [phase, setPhase] = useState(0);
  const [now, setNow] = useState(new Date());

  const [isPlaying, setIsPlaying] = useFirebaseSync<boolean>('quran_radio_playing', false);
  const [volume, setVolume] = useState(() => quranRadioManager.getVolume());
  const location = useLocation();
  const initialTab = new URLSearchParams(location.search).get('tab');
  const [prayerTab, setPrayerTab] = useState<'times' | 'radio' | 'quran'>(
    initialTab === 'radio' || initialTab === 'quran' ? initialTab : 'times'
  );

  const getCurrentPrayerName = () => {
    if (!times || Object.keys(times).length === 0) return '';
    const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    
    const prayerTimes = prayerNames.map(name => {
      const timeStr = times[name];
      if (!timeStr) return { name, date: new Date(0) };
      const [h, m] = timeStr.split(':').map(Number);
      const pDate = new Date(now);
      pDate.setHours(h, m, 0, 0);
      return { name, date: pDate };
    });
    
    prayerTimes.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    let current = 'Isha';
    for (const p of prayerTimes) {
      if (now >= p.date) {
        current = p.name;
      }
    }
    return current;
  };

  const currentPrayerName = getCurrentPrayerName();

  // Listen to quranRadioManager events to update local volume
  useEffect(() => {
    // Volume initialized from manager
  }, []);

  // Sync actual HTMLAudioElement playback with Firebase isPlaying state
  useEffect(() => {
    const managerPlaying = quranRadioManager.isPlaying();
    if (isPlaying && !managerPlaying) {
      quranRadioManager.play();
    } else if (!isPlaying && managerPlaying) {
      quranRadioManager.pause();
    }
  }, [isPlaying]);

  const togglePlay = () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    if (nextState) {
      quranRadioManager.play();
    } else {
      quranRadioManager.pause();
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

  // Exact 15:00 boundary — using totalRemainingSeconds instead of the floored
  // remainingMinutes avoids showing the timer up to 59s early.
  const showTimer = nextPrayer && (nextPrayer as any).totalRemainingSeconds <= 15 * 60;

  return (
    <div className="min-h-screen bg-bg text-ink py-6 md:py-12 px-6 md:px-12 lg:px-20 font-sans-main flex flex-col transition-colors duration-300">
      
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
          <span className="font-mono-main text-[10px] uppercase tracking-[0.25em] font-bold text-ink/50">Devotion</span>
        </div>

        <div className="flex flex-col">
          <h1 className="font-sans-main text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-ink">
            DEVOTION
          </h1>
        </div>
      </header>

      {/* TABS */}
      <div className="w-full max-w-[1000px] mx-auto mb-6">
        <div className="flex border border-ink/20 overflow-hidden relative bg-[var(--paper-dark)] w-fit">
          {(['quran', 'times', 'radio'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setPrayerTab(tab)}
              className="relative font-mono-main text-[10px] uppercase tracking-widest font-bold px-6 py-2.5 cursor-pointer transition-colors duration-200"
              style={{ color: prayerTab === tab ? 'var(--paper)' : 'var(--ink)' }}
            >
              {prayerTab === tab && (
                <motion.div
                  layoutId="prayerPageTabBg"
                  className="absolute inset-0 bg-[var(--ink)]"
                  transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                  style={{ zIndex: 0 }}
                />
              )}
              <span className="relative z-10">{tab === 'times' ? 'Prayer Times' : tab === 'radio' ? 'Radio' : 'Quran'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="w-full max-w-[1000px] mx-auto flex flex-col gap-6">

        {prayerTab === 'times' && showTimer && nextPrayer && (
          <div className="brutalist-card no-lift p-6 sm:p-8 text-center border-l-4 border-l-forest bg-forest/5">
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.25em] font-black mb-8 text-forest">
              Up Next: {nextPrayer.name} ({nextPrayer.time})
            </div>
            <div className="relative w-full max-w-[280px] aspect-square mx-auto flex items-center justify-center">
              {/* Starts exactly 15 minutes before the prayer (see showTimer above) and fills
                  forward as time elapses, same direction as the focus timer — not a
                  countdown-style unfilling ring. */}
              <WavyRing
                pct={Math.max(0, Math.min(100, (1 - (nextPrayer as any).totalRemainingSeconds / (15 * 60)) * 100))}
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

        {prayerTab === 'times' && (
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

                  // Active from 15 minutes before its Athan time until 15 minutes after its Athan time
                  const isActive = (() => {
                    const [h, m] = time.split(':').map(Number);
                    const pDate = new Date(now);
                    pDate.setHours(h, m, 0, 0);
                    const diffMins = (now.getTime() - pDate.getTime()) / 60000;
                    return diffMins >= -15 && diffMins <= 15;
                  })();

                  return (
                    <div
                      key={name}
                      className={`p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center transition-all duration-300 border border-ink ${
                        isActive
                          ? 'bg-[var(--paper-dark)] border-ink text-ink'
                          : 'bg-paper-dark prayer-card-inactive text-ink'
                      }`}
                    >
                      <div className="flex-1">
                         <div className={`text-3xl font-black tracking-tighter ${isActive ? 'text-ink' : statusColors[status]}`}>
                            {name}
                         </div>
                         <div className={`text-[10px] font-black uppercase tracking-[0.2em] mt-1 ${isActive ? 'text-forest' : 'text-ink/20'}`}>
                            {isActive ? 'Current Phase' : status}
                         </div>
                      </div>
                      <div className="text-left sm:text-right flex-1 mt-3 sm:mt-0">
                         <div className={`text-4xl font-black tracking-tighter ${isActive ? 'text-forest' : statusColors[status]}`}>{formatTo12h(time)}</div>
                         {isActive && (
                            <div className="text-[10px] font-black text-forest uppercase tracking-widest mt-1">Active now</div>
                         )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {hijri && (
            <div className="text-center pb-6 mt-6">
              <p className="text-[10px] font-black text-forest/30 uppercase tracking-[0.5em] mb-2">Hijri Date</p>
              <p lang="ar" className="font-arabic-main text-xl font-black text-sepia tracking-tight">{hijri}</p>
            </div>
          )}
        </div>
        )}

        {prayerTab === 'radio' && (
        <div className={`p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center transition-all duration-300 border border-ink ${
          isPlaying
            ? 'bg-[var(--paper-dark)] border-ink text-ink'
            : 'bg-paper-dark prayer-card-inactive text-ink'
        }`}>
          <div className="flex-1">
             <div className="text-3xl font-black tracking-tighter text-ink">
                Quran Radio
             </div>
          </div>
          <div className="text-left sm:text-right flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mt-3 sm:mt-0 w-full sm:w-auto">
             <div className="flex items-center gap-3 justify-between sm:justify-start">
                {isPlaying && (
                   <div className="flex items-end gap-0.5 h-4 w-8 pr-2">
                      <span className="w-0.5 bg-[var(--sepia)] animate-[pulseWave_0.8s_infinite_ease-in-out_alternate]" style={{ height: '30%' }} />
                      <span className="w-0.5 bg-[var(--sepia)] animate-[pulseWave_1.2s_infinite_ease-in-out_alternate_0.2s]" style={{ height: '50%' }} />
                      <span className="w-0.5 bg-[var(--sepia)] animate-[pulseWave_0.9s_infinite_ease-in-out_alternate_0.4s]" style={{ height: '70%' }} />
                      <span className="w-0.5 bg-[var(--sepia)] animate-[pulseWave_1.1s_infinite_ease-in-out_alternate_0.1s]" style={{ height: '40%' }} />
                   </div>
                )}
                {/* Volume Control */}
                <div className="flex items-center gap-2 border px-3 py-1.5 flex-1 sm:flex-initial bg-[var(--bg)] border-ink/20">
                  <span className="font-mono-main text-[9px] font-bold uppercase tracking-widest text-ink/40">Vol</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setVolume(v);
                      quranRadioManager.setVolume(v);
                    }}
                    className="w-20 brutalist-slider cursor-pointer"
                  />
                  <span className="font-mono-main text-[9px] font-bold min-w-[24px] text-right text-ink/60">{Math.round(volume * 100)}%</span>
                </div>
             </div>
             <button
                onClick={togglePlay}
                className={`btn-brutalist px-6 py-2.5 text-xs font-mono-main cursor-pointer w-full sm:w-auto ${
                  isPlaying ? 'bg-[var(--sepia)] text-black border-[var(--sepia)] hover:bg-[var(--sepia)]/90' : ''
                }`}
             >
                {isPlaying ? 'PAUSE' : 'PLAY LIVE'}
               </button>
          </div>
        </div>
        )}

        {prayerTab === 'quran' && (
        <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center border border-ink bg-paper-dark prayer-card-inactive text-ink">
          <div className="flex-1">
            <div className="text-3xl font-black tracking-tighter text-ink">
              Holy Quran
            </div>
          </div>
          <button
            onClick={() => navigate('quran')}
            className="btn-brutalist px-6 py-2.5 text-xs font-mono-main cursor-pointer mt-3 sm:mt-0 w-full sm:w-auto"
          >
            READ
          </button>
        </div>
        )}

      </main>

    </div>
  );
};
