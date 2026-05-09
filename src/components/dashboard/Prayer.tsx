import React, { useState, useEffect } from 'react';
import { MOCK_PRAYER_TIMES } from '../../constants/mockData';
import { BackBtn } from '../layout/Common';
import { HugeiconsIcon } from '@hugeicons/react';
import { RefreshIcon } from '@hugeicons/core-free-icons';
import { WavyRing } from './Pomodoro';
import { PageHeader } from '../ui/UIComponents';

interface PrayerProps {
  navigate: (to: string) => void;
}

export const Prayer: React.FC<PrayerProps> = ({ navigate }) => {
  const [times, setTimes] = useState<Record<string, string>>({});
  const [hijriDate, setHijriDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [phase, setPhase] = useState(0);

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
      const response = await fetch('https://api.aladhan.com/v1/timingsByCity?city=Mansoura&country=Egypt&method=5');
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
      setTimes({ Fajr: MOCK_PRAYER_TIMES.Fajr, Dhuhr: MOCK_PRAYER_TIMES.Dhuhr, Asr: MOCK_PRAYER_TIMES.Asr, Maghrib: MOCK_PRAYER_TIMES.Maghrib, Isha: MOCK_PRAYER_TIMES.Isha });
      setHijriDate('');
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
    return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
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
    passed: 'text-ink/10' 
  };

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-12 px-4 sm:px-6 min-h-screen">
      <BackBtn onClick={()=>navigate('home')} />
      
      <PageHeader 
        title="Prayer" 
        subtitle="Mansoura, Egypt" 
        className="[&>h2]:text-5xl sm:[&>h2]:text-6xl"
      />
      
      {upcomingEntry && (
        <div className="sys-card p-6 sm:p-12 text-center mb-8 sm:mb-12 border-l-4 sm:border-l-8 border-l-forest bg-forest/5">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.4em] font-black mb-8 sm:mb-12 text-forest">
            Up Next: {upcomingEntry[0]}
          </div>
          <div className="relative w-full max-w-[320px] aspect-square mx-auto flex items-center justify-center">
            <WavyRing pct={getUpcomingPct(upcomingEntry[1])} phase={phase} mode="focus" isOvertime={false} running={true} size={320} waves={16} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none translate-y-1">
              <span className="text-4xl sm:text-[54px] font-black text-ink tabular-nums leading-none">{getCountdown(upcomingEntry[1])}</span>
              <span className="text-[9px] tracking-[0.2em] sm:tracking-[0.4em] font-black text-ink/30 uppercase mt-3 sm:mt-5">Remaining</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="sys-card py-24 text-center text-ink/20 font-black uppercase tracking-widest text-sm animate-pulse">Syncing...</div>
        ) : prayerEntries.map(([name, time]) => {
          const status = getStatus(time);
          const isActive = status === 'active';
          
          return (
            <div key={name} className={`sys-card p-6 sm:p-12 flex flex-col sm:flex-row justify-between items-start sm:items-center transition-all duration-500 ${isActive ? 'border-l-4 sm:border-l-8 border-l-forest bg-forest/5 scale-100 sm:scale-[1.02]' : 'opacity-80'}`}>
              <div className="flex-1">
                 <div className={`text-3xl sm:text-4xl font-black tracking-tighter ${statusColors[status]}`}>{name}</div>
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

      {hijriDate && (
        <div className="mt-8 sm:mt-12 sys-card p-6 sm:p-10 text-center text-xs sm:text-sm font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] text-ink/30 bg-paper/30">
          {hijriDate}
        </div>
      )}
    </div>
  );
};
