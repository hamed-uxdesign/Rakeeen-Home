import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { POMODORO_WEEKLY_MOCK, POMODORO_MONTHLY_MOCK } from '../../constants/mockData';
import { formatTime, getTodayIdx } from '../../utils/timeHelpers';
import { BackBtn } from '../layout/Common';
import { Card, Button, Label } from '../ui/UIComponents';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlayIcon, PauseIcon, RefreshIcon } from '@hugeicons/core-free-icons';

interface PomodoroProps {
  navigate: (to: string) => void;
}

export const Pomodoro: React.FC<PomodoroProps> = ({ navigate }) => {
  const FOCUS = 25 * 60, BREAK = 5 * 60;
  const [timeLeft, setTimeLeft] = useState(FOCUS);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [sessions, setSessions] = useState(0);
  const [weekStats, setWeekStats] = useFirebaseSync('pomodoro_week', POMODORO_WEEKLY_MOCK);
  const [view, setView] = useState<'week' | 'month'>('week');
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mode === 'focus') {
              setSessions(s => s + 1);
              const todayIdx = getTodayIdx();
              const updated = weekStats.map((d: any, i: number) => i === todayIdx ? { ...d, sessions: d.sessions + 1 } : d);
              setWeekStats(updated);
              setMode('break');
              setRunning(false);
              return BREAK;
            } else {
              setMode('focus');
              setRunning(false);
              return FOCUS;
            }
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, mode, weekStats, setWeekStats]);

  const reset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
    setMode('focus');
    setTimeLeft(FOCUS);
  };

  const pct = mode === 'focus' ? ((FOCUS - timeLeft) / FOCUS) * 100 : ((BREAK - timeLeft) / BREAK) * 100;
  const r = 80, circ = 2 * Math.PI * r;

  return (
    <div className="max-w-2xl mx-auto py-10 px-5">
      <BackBtn onClick={()=>navigate('home')} />
      
      <header className="mb-10">
        <h2 className="text-4xl font-black text-ink mb-1">Pomodoro</h2>
        <p className="text-[10px] text-ink/30 tracking-[0.2em] font-black">Focus sessions & productivity analytics</p>
      </header>

      <Card variant="sketchy" className="text-center mb-10 pb-10">
        <Label className={`mb-8 font-black ${mode==='focus'?'text-forest':'text-sepia'}`}>
          {mode==='focus'?'⚡ Focus session':'☕ Break time'}
        </Label>

        <div className="relative w-[200px] h-[200px] mx-auto group">
          {/* Subtle glow behind timer */}
          <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 -z-10 transition-colors ${mode==='focus'?'bg-forest':'bg-sepia'}`} />
          
          <svg width="200" height="200" viewBox="0 0 200 200" className="block mx-auto transform -rotate-90">
            <circle cx="100" cy="100" r={r} fill="none" stroke="var(--bg)" strokeWidth="8" className="opacity-50" />
            <circle cx="100" cy="100" r={r} fill="none"
              stroke={mode==='focus'?'var(--forest)':'var(--sepia)'} strokeWidth="8"
              strokeDasharray={circ} strokeDashoffset={circ * (1 - pct/100)}
              strokeLinecap="round"
              style={{transition:'stroke-dashoffset 0.5s ease-out'}}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-5xl font-black text-ink mb-1">{formatTime(timeLeft)}</span>
            <span className="text-[10px] tracking-[0.3em] font-bold text-ink/40">{mode}</span>
          </div>
        </div>

        <div className="flex justify-center gap-4 mt-10">
          <Button variant="premium" onClick={()=>setRunning(!running)} className="min-w-[140px]">
             {running ? <HugeiconsIcon icon={PauseIcon} size={18} /> : <HugeiconsIcon icon={PlayIcon} size={18} />}
             <span className="ml-2 tracking-widest">{running ? 'Pause' : 'Start'}</span>
          </Button>
          <Button variant="sketchy" onClick={reset} className="border-ink/20 opacity-60 hover:opacity-100 px-5">
             <HugeiconsIcon icon={RefreshIcon} size={18} />
          </Button>
        </div>

        <div className="mt-8 text-xs font-bold text-ink/50 tracking-widest">
          Sessions today: <span className="text-sepia font-black mx-1">{sessions}</span>
          <span className="opacity-30 mx-2">|</span> 
          Focus time: <span className="text-sepia font-black mx-1">{Math.round(sessions * 25)} min</span>
        </div>
      </Card>

      <Card variant="sketchy" title="Productivity stats" className="bg-paper/30">
        <div className="absolute top-8 right-8 flex gap-2">
          {(['week','month'] as const).map(v=>(
            <button key={v} onClick={()=>setView(v)}
              className={`text-[9px] tracking-widest font-black px-3 py-1 rounded-full border-2 transition-all ${view===v ? 'border-sepia text-sepia bg-sepia/10' : 'border-ink/10 text-ink/40 hover:border-ink/30'}`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="h-[220px] w-full mt-8">
          <ResponsiveContainer>
            <BarChart data={view==='week'?weekStats:POMODORO_MONTHLY_MOCK}>
              <CartesianGrid vertical={false} stroke="rgba(232,224,208,0.05)" />
              <XAxis dataKey={view==='week'?'day':'week'} tick={{fill:'var(--ink)',opacity:0.4,fontSize:10,fontWeight:700}} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={{fill:'var(--ink)',opacity:0.4,fontSize:10,fontWeight:700}} axisLine={false} tickLine={false} dx={-10} />
              <Tooltip 
                contentStyle={{background:'var(--paper)',border:'2px solid var(--border)',color:'var(--ink)',borderRadius:'12px',fontFamily:'var(--font-sans)',fontSize:'12px',fontWeight:700}} 
                cursor={{fill:'rgba(124,169,130,0.1)'}} 
              />
              <Bar dataKey="sessions" fill="var(--forest)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
