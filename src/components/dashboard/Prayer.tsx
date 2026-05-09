import React, { useState, useEffect } from 'react';
import { MOCK_PRAYER_TIMES } from '../../constants/mockData';
import { BackBtn } from '../layout/Common';
import { HugeiconsIcon } from '@hugeicons/react';
import { RefreshIcon } from '@hugeicons/core-free-icons';
import { WavyRing } from './Pomodoro';

interface PrayerProps {
  navigate: (to: string) => void;
}

export const Prayer: React.FC<PrayerProps> = ({ navigate }) => {
  const [times, setTimes] = useState<Record<string, string>>({});
  const [hijriDate, setHijriDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [phase, setPhase] = useState(0);

  // Wave animation for the upcoming ring
  useEffect(() => {
    let animId: number;
    const animate = () => {
      setPhase(p => (p + 0.05) % (Math.PI * 2));
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  const fetchPrayerTimes = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('https://api.aladhan.com/v1/timingsByCity?city=Mansoura&country=Egypt&method=5', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (data.code === 200) {
        const t = data.data.timings;
        setTimes({ Fajr: t.Fajr, Dhuhr: t.Dhuhr, Asr: t.Asr, Maghrib: t.Maghrib, Isha: t.Isha });
        const h = data.data.date.hijri;
        setHijriDate(`${h.day} ${h.month.ar} ${h.year} هـ`);
      } else {
        throw new Error("Invalid API response");
      }
    } catch (error) {
      console.error('Failed to fetch prayer times, using fallback:', error);
      // Fallback to MOCK_PRAYER_TIMES so the UI doesn't break
      setTimes({
        Fajr: MOCK_PRAYER_TIMES.Fajr,
        Dhuhr: MOCK_PRAYER_TIMES.Dhuhr,
        Asr: MOCK_PRAYER_TIMES.Asr,
        Maghrib: MOCK_PRAYER_TIMES.Maghrib,
        Isha: MOCK_PRAYER_TIMES.Isha
      });
      setHijriDate('Offline Mode (Local Time)');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrayerTimes();
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getStatus = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const prayerDate = new Date(now);
    prayerDate.setHours(h, m, 0, 0);
    
    const diffMs = now.getTime() - prayerDate.getTime();
    const diffMins = diffMs / (1000 * 60);

    if (diffMins >= 0 && diffMins <= 15) return 'active';
    if (diffMins >= -15 && diffMins < 0) return 'upcoming';
    return diffMins < 0 ? 'pending' : 'passed';
  };

  const getCountdown = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const prayerDate = new Date(now);
    prayerDate.setHours(h, m, 0, 0);
    const diffSecs = Math.max(0, Math.floor((prayerDate.getTime() - now.getTime()) / 1000));
    const mins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatTo12h = (time24: string) => {
    let [h, m] = time24.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return (
      <>
        {h}:{String(m).padStart(2, '0')}{' '}
        <span className="text-sm opacity-50 font-normal">{suffix}</span>
      </>
    );
  };

  const prayerEntries = Object.entries(times);
  const upcomingEntry = prayerEntries.find(([name, time]) => getStatus(time) === 'upcoming');

  const getUpcomingPct = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const pDate = new Date(now);
    pDate.setHours(h, m, 0, 0);
    const minsLeft = (pDate.getTime() - now.getTime()) / 60000;
    return Math.max(0, Math.min(100, ((15 - minsLeft) / 15) * 100));
  };

  const statusColors: Record<string, string> = { 
    active: 'text-[var(--forest)]', 
    upcoming: 'text-[var(--forest)]', 
    pending: 'text-ink/60', 
    passed: 'text-ink/20' 
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-5">
      <BackBtn onClick={()=>navigate('home')} />
      
      <header className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-ink mb-1">Prayer times</h2>
          <p className="text-[10px] text-ink/30 tracking-[0.3em] font-black uppercase">Mansoura, Egypt</p>
        </div>
      </header>
      
      {upcomingEntry && (
        <div className="text-center mb-10 sys-card p-8 relative animate-scale-in">
          <div className="text-[10px] uppercase tracking-[0.3em] font-black mb-8 text-[var(--forest)]">
            Upcoming: {upcomingEntry[0]}
          </div>
          <div className="relative w-[200px] h-[200px] mx-auto flex items-center justify-center">
            <div className="absolute inset-8 rounded-full blur-[60px] opacity-20 -z-10 transition-colors duration-1000 bg-[var(--forest)]" />
            <WavyRing pct={getUpcomingPct(upcomingEntry[1])} phase={phase} mode="focus" isOvertime={false} running={true} size={200} waves={10} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-4xl font-black mb-1 text-ink">
                {getCountdown(upcomingEntry[1])}
              </span>
              <span className="text-[10px] tracking-[0.3em] font-bold text-ink/40 uppercase mt-1">
                Time left
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="py-20 text-center text-ink/30 font-bold tracking-widest animate-pulse">
            Syncing Mansoura timings...
          </div>
        ) : prayerEntries.map(([name, time]) => {
          const status = getStatus(time);
          const isActive = status === 'active';
          const isUpcoming = status === 'upcoming';
          
          return (
            <div key={name} 
              className={`flex justify-between items-center py-6 px-8 transition-all duration-700 relative
                ${isActive ? 'sys-card shadow-[4px_4px_0px_0px_rgba(232,224,208,0.05)] border-[var(--forest)]' : 'bg-transparent border-2 border-transparent'}
              `}
            >
              {isUpcoming && (
                <div className="absolute -left-28 top-1/2 -translate-y-1/2 w-24 h-24 flex items-center justify-center">
                  <WavyRing pct={getUpcomingPct(time)} phase={phase} mode="focus" isOvertime={false} running={true} size={110} waves={8} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-base font-black tabular-nums text-[var(--forest)] tracking-tighter">
                      {getCountdown(time)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 relative z-10">
                <div className="w-2 flex justify-center">
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[var(--forest)]" />}
                </div>
                
                <div>
                  <div className={`text-2xl font-bold ${statusColors[status]}`}>{name}</div>
                  {isUpcoming && <div className="text-[9px] tracking-[0.2em] font-black text-[var(--forest)]/50 mt-1 uppercase">Upcoming</div>}
                </div>
              </div>
              <div className={`text-3xl font-medium ${statusColors[status]} relative z-10`}>{formatTo12h(time)}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 text-center text-xs text-ink/20 font-mono font-bold tracking-widest">
        {hijriDate || 'Calculating Hijri date...'}
      </div>
    </div>
  );
};
