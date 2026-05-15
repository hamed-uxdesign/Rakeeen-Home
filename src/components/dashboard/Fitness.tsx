import React, { useState, useEffect } from 'react';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { BackBtn } from '../layout/Common';
import { Button, Input, PageHeader, ChartTooltip } from '../ui/UIComponents';
import { Tabs } from '../ui/Tabs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Dumbbell01Icon, 
  Delete02Icon,
  Tick01Icon,
  ZapIcon
} from '@hugeicons/core-free-icons';
import { useNavigate } from 'react-router-dom';

interface FitnessProps {
  navigate?: (to: string) => void;
}

export const Fitness: React.FC<FitnessProps> = ({ navigate: propsNavigate }) => {
  const navigate = propsNavigate || useNavigate();
  const [tab, setTab] = useState<'workout' | 'challenge' | 'analytics'>('workout');
  
  const [workouts, setWorkouts] = useFirebaseSync<any[]>('fitness_workouts', []);
  const [sugarChallenge, setSugarChallenge] = useFirebaseSync<any>('fitness_sugar', { lastCheckIn: '', completedDays: 0 });
  const [reportView, setReportView] = useState<'week' | 'month' | 'year'>('week');
  const [wDuration, setWDuration] = useState('');
  const [nextSleepTime, setNextSleepTime] = useState<Date | null>(null);

  const addWorkout = () => {
    if (!wDuration) return;
    setWorkouts([{ id: Date.now().toString(), duration: Number(wDuration), date: new Date().toDateString(), time: new Date().toLocaleTimeString() }, ...workouts]);
    setWDuration('');
  };
  const deleteWorkout = (id: string) => setWorkouts(workouts.filter(w => w.id !== id));

  const checkInSugar = () => {
    const today = new Date().toDateString();
    if (sugarChallenge.lastCheckIn === today) return;
    setSugarChallenge({ lastCheckIn: today, completedDays: (sugarChallenge.completedDays || 0) + 1 });
  };
  const resetSugar = () => {
    setSugarChallenge({ lastCheckIn: '', completedDays: 0 });
  };

  // --- Streak Reset Logic: If a day is missed, reset to 0 ---
  useEffect(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    // Only reset if challenge is in progress (1-20 days)
    if (sugarChallenge.completedDays > 0 && sugarChallenge.completedDays < 21) {
      const last = sugarChallenge.lastCheckIn;
      
      // 1. Natural day-after reset (if they woke up and yesterday was missed)
      const dayMissed = last && last !== todayStr && last !== yesterdayStr;
      
      // 2. Bedtime reset (if it's past bedtime and today isn't checked)
      const isPastBedtime = nextSleepTime && now >= nextSleepTime;
      const bedtimeMissed = isPastBedtime && last !== todayStr;

      if (dayMissed || bedtimeMissed) {
        setSugarChallenge({ lastCheckIn: '', completedDays: 0 });
      }
    }
  }, [sugarChallenge.completedDays, sugarChallenge.lastCheckIn, setSugarChallenge, nextSleepTime]);

  const isTodayChecked = sugarChallenge.lastCheckIn === new Date().toDateString();
  const isChallengeDone = sugarChallenge.completedDays >= 21;

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // --- Workout Logic ---
  const WORKOUT_DAYS = [0, 3]; // Sun, Wed
  const today = new Date();
  const todayIdx = today.getDay();
  const isWorkoutDay = WORKOUT_DAYS.includes(todayIdx);
  const workoutLoggedToday = workouts.some(w => w.date === today.toDateString());
  
  const getNextWorkout = () => {
    let next = new Date();
    for (let i = 1; i <= 7; i++) {
      let check = new Date();
      check.setDate(today.getDate() + i);
      if (WORKOUT_DAYS.includes(check.getDay())) return check;
    }
    return next;
  };



  useEffect(() => {
    const fetchSleep = async () => {
      try {
        const res = await fetch(`https://corsproxy.io/?${encodeURIComponent('https://calendar.google.com/calendar/ical/9ce9f7279f0afeef711ae5c21eb29f4f087e8cb74aef36a9bbd0d58751e61587%40group.calendar.google.com/private-8496d29b04f57f4c8452f99dd5dbe203/basic.ics')}`);
        const text = await res.text();
        const unfoldedText = text.replace(/\r?\n[ \t]/g, '');
        const lines = unfoldedText.split(/\r?\n/);
        let sleep: Date | null = null;
        let curr: any = {};
        const now = new Date();

        const parseDate = (str: string) => {
          if (!str) return null;
          const cleanStr = str.replace(/[:;].*$/, '').trim();
          if (cleanStr.length < 8) return null;
          const y = parseInt(cleanStr.slice(0, 4));
          const m = parseInt(cleanStr.slice(4, 6)) - 1;
          const d = parseInt(cleanStr.slice(6, 8));
          if (cleanStr.includes('T')) {
            const h = parseInt(cleanStr.slice(9, 11));
            const min = parseInt(cleanStr.slice(11, 13));
            return new Date(y, m, d, h, min);
          }
          return new Date(y, m, d);
        };

        for (let line of lines) {
          if (line.startsWith('BEGIN:VEVENT')) curr = {};
          else if (line.startsWith('END:VEVENT')) {
            const isSleep = curr.summary?.toLowerCase().includes('sleep') || curr.summary?.toLowerCase().includes('أسليب');
            if (isSleep && curr.dtstart) {
              const start = parseDate(curr.dtstart);
              if (start) {
                const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
                if (diffHours > -2 && diffHours < 24) {
                  if (!sleep || start.getTime() < sleep.getTime()) sleep = start;
                }
              }
            }
          }
          else if (line.startsWith('SUMMARY:')) curr.summary = line.substring(8);
          else if (line.startsWith('DTSTART')) curr.dtstart = line.split(':')[1] || line.split(';')[1]?.split(':')[1];
        }
        setNextSleepTime(sleep);
      } catch (e) { console.error(e); }
    };
    fetchSleep();
  }, []);

  const nextWorkout = getNextWorkout();
  const diffDays = Math.ceil((nextWorkout.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  const lateThreshold = nextSleepTime ? new Date(nextSleepTime.getTime() - 3 * 60 * 60 * 1000) : new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0);
  const isLate = today >= lateThreshold;
  const isMissed = isWorkoutDay && isLate && !workoutLoggedToday;

  // --- ANALYTICS: Current period only. No cross-period accumulation. ---
  const getWorkoutReports = () => {
    const todayStr = today.toDateString();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDayIdx = today.getDay(); // 0=Sun

    // ── WEEK: Sat-Fri of THIS calendar week only ──────────────────────────────
    const weekDays = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const weekData = weekDays.map((name, i) => {
      const targetDayIdx = [6, 0, 1, 2, 3, 4, 5][i];
      const d = new Date(today);
      d.setDate(today.getDate() - ((currentDayIdx - targetDayIdx + 7) % 7));
      const dateStr = d.toDateString();
      const isFuture = d > today && dateStr !== todayStr;
      if (isFuture) return { name, minutes: 0 };
      const mins = workouts.filter(w => w.date === dateStr).reduce((a, b) => a + (Number(b.duration) || 0), 0);
      return { name, minutes: mins };
    });

    // ── MONTH: Week 1-4 of THIS calendar month only ───────────────────────────
    const monthData = [
      { name: 'Week 1', minutes: 0 }, { name: 'Week 2', minutes: 0 },
      { name: 'Week 3', minutes: 0 }, { name: 'Week 4', minutes: 0 }
    ];
    workouts.forEach(w => {
      const d = new Date(w.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const weekIdx = Math.min(Math.floor((d.getDate() - 1) / 7), 3);
        monthData[weekIdx].minutes += (Number(w.duration) || 0);
      }
    });

    // ── YEAR: Jan-Dec of THIS calendar year only ──────────────────────────────
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const yearData = monthNames.map(name => ({ name, minutes: 0 }));
    workouts.forEach(w => {
      const d = new Date(w.date);
      if (d.getFullYear() === currentYear) {
        yearData[d.getMonth()].minutes += (Number(w.duration) || 0);
      }
    });

    return { week: weekData, month: monthData, year: yearData };
  };

  const workoutReports = getWorkoutReports();

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-12 px-4 sm:px-6 min-h-screen">
      <BackBtn onClick={() => navigate('home')} />
      <PageHeader 
        title="Fitness" 
        subtitle="Training & Discipline" 
      />

      <Tabs 
        tabs={[
          { id: 'workout', label: 'Workouts' },
          { id: 'challenge', label: 'No Sugar' },
          { id: 'analytics', label: 'Analytics' },
        ]}
        activeTab={tab}
        onChange={(v) => setTab(v as any)}
        className="mb-8 sm:mb-12 gap-2"
        size="md"
      />

      {tab === 'workout' && (
        <div className="animate-scale-in space-y-6 sm:space-y-8">
           <div className={`sys-card p-6 sm:p-12 text-center transition-all duration-500 ${isMissed ? 'bg-rust/10 border-rust border-l-8' : isWorkoutDay && workoutLoggedToday ? 'bg-forest/10 border-forest border-l-8' : 'bg-paper-dark border-ink/5'}`}>
              {isMissed ? (
                <HugeiconsIcon icon={ZapIcon} size={48} className="text-rust mx-auto mb-6 sm:mb-8 animate-bounce" />
              ) : (
                <HugeiconsIcon icon={Dumbbell01Icon} size={48} className={`mx-auto mb-6 sm:mb-8 ${isWorkoutDay && workoutLoggedToday ? 'text-forest' : 'text-ink/20'}`} />
              )}
              
              <h3 className="text-2xl sm:text-4xl font-black text-ink mb-4 tracking-tighter">
                {isMissed ? 'ACTION REQUIRED' : isWorkoutDay ? (workoutLoggedToday ? 'PROTOCOL SECURED' : 'TRAINING DAY') : 'RECOVERY PHASE'}
              </h3>
              
              <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-8">
                 {days.map((d, i) => {
                   const isW = WORKOUT_DAYS.includes(i);
                   return (
                     <div key={d} className={`text-[10px] font-black px-2 sm:px-3 py-1 rounded-full ${isW ? (i === todayIdx ? 'bg-forest text-paper' : 'border-2 border-forest text-forest') : 'opacity-20'}`}>
                       {d.toUpperCase()}
                     </div>
                   );
                 })}
              </div>

              {isMissed ? (
                <p className="text-xs sm:text-sm text-rust font-black uppercase tracking-widest px-4">Excuses don't burn calories. Log it now.</p>
              ) : isWorkoutDay && workoutLoggedToday ? (
                <p className="text-xs sm:text-sm text-forest font-black uppercase tracking-widest px-4">Performance optimized for today.</p>
              ) : (
                <p className="text-xs sm:text-sm text-ink/40 font-bold max-w-xs mx-auto leading-relaxed px-4">
                  Next session in <span className="text-ink font-black">{diffDays} {diffDays === 1 ? 'day' : 'days'}</span> ({nextWorkout.toLocaleDateString('en-US', { weekday: 'long' })})
                </p>
              )}
           </div>
           <div className="sys-card p-6 sm:p-10">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-stretch sm:items-end">
                <div className="flex-1">
                  <Input label="Duration (Minutes)" type="number" placeholder="60" value={wDuration} onChange={e => setWDuration(e.target.value)} className="h-14 sm:h-16 text-lg sm:text-xl" />
                </div>
                <Button variant="premium" onClick={addWorkout} className="h-14 sm:h-16 px-12 text-sm sm:text-lg">Log</Button>
              </div>
           </div>
           <div className="space-y-4 sm:space-y-6">
              {workouts.map((w) => (
                <div key={w.id} className="sys-card p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 border-l-8 border-l-forest hover:translate-x-2 transition-all group">
                   <div>
                      <div className="text-[10px] sm:text-xs font-black opacity-20 uppercase tracking-widest mb-1 sm:mb-2">{w.date} · {w.time}</div>
                      <div className="text-xl sm:text-2xl font-black text-ink tracking-tighter">Session Complete</div>
                   </div>
                   <div className="flex items-center gap-4 sm:gap-8 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-3xl sm:text-4xl font-black text-forest tracking-tighter">{w.duration}<span className="text-[10px] sm:text-xs ml-1 sm:ml-2 opacity-30 uppercase font-black">min</span></div>
                      <button onClick={() => deleteWorkout(w.id)} className="text-rust p-3 hover:bg-rust/10 transition-all sm:opacity-0 sm:group-hover:opacity-100 rounded-md"><HugeiconsIcon icon={Delete02Icon} size={22} /></button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {tab === 'challenge' && (
        <div className="animate-scale-in space-y-6 sm:space-y-8">
          <div className={`sys-card p-6 sm:p-12 text-center ${isChallengeDone ? 'bg-forest/5 border-2 border-forest' : ''}`}>
             <div className="mb-8 sm:mb-12">
                <h3 className="text-3xl sm:text-4xl font-black text-ink mb-2 tracking-tighter">
                  {isChallengeDone ? 'HABIT SECURED' : 'No Sugar'}
                </h3>
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] text-forest opacity-60">
                  {isChallengeDone ? 'LIFETIME MAINTENANCE' : 'Discipline Protocol'}
                </p>
             </div>

             {!isChallengeDone ? (
               <>
                 <div className="grid grid-cols-7 gap-2 sm:gap-4 mb-8 sm:mb-12 max-w-md mx-auto px-2">
                    {Array.from({ length: 21 }).map((_, i) => (
                      <div 
                        key={i} 
                        className="aspect-square border-2 transition-all duration-700 flex items-center justify-center rounded-sm sm:rounded-md"
                        style={{ 
                          backgroundColor: i < sugarChallenge.completedDays ? 'var(--forest)' : 'rgba(26,26,26,0.08)',
                          borderColor: i < sugarChallenge.completedDays ? 'var(--forest)' : 'rgba(26,26,26,0.25)'
                        }}
                      >
                        {i < sugarChallenge.completedDays && (
                          <HugeiconsIcon icon={Tick01Icon} size={20} style={{ color: 'var(--paper)' }} />
                        )}
                      </div>
                    ))}
                 </div>
                 <div className="text-center mb-8 sm:mb-12">
                    <div className="text-6xl sm:text-[100px] font-black text-forest leading-none tracking-tighter">{sugarChallenge.completedDays}</div>
                    <div className="text-[10px] sm:text-xs font-black text-ink/20 uppercase tracking-[0.3em] mt-2 sm:mt-4">Days Completed / 21</div>
                 </div>
                 <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <Button variant="premium" onClick={checkInSugar} disabled={isTodayChecked} className="flex-1 h-16 sm:h-20 !bg-forest !text-paper !border-forest text-sm sm:text-lg tracking-widest font-black uppercase">{isTodayChecked ? 'Day Secured' : 'Log Success'}</Button>

                 </div>
               </>
             ) : (
               <div className="py-6 sm:py-10">
                 <div className="w-32 h-32 bg-forest rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(124,169,130,0.3)]">
                    <HugeiconsIcon icon={ZapIcon} size={64} style={{ color: 'var(--paper)' }} />
                 </div>
                 <p className="text-lg font-black text-ink mb-12 max-w-sm mx-auto leading-relaxed">The 21-day cycle is complete. You are now in the <span className="text-forest">Reward Protocol</span>.</p>
                 <div className="bg-paper p-8 border-2 border-dashed border-forest/30 inline-block">
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-ink/30 mb-2">Next Friday Reward</div>
                    <div className="text-2xl font-black text-forest tracking-tighter">SUGAR REWARD UNLOCKED</div>
                 </div>
                 <div className="mt-12">
                    <button onClick={resetSugar} className="text-[10px] font-black uppercase tracking-widest text-ink/20 hover:text-rust transition-all italic">Reset Challenge (Not Recommended)</button>
                 </div>
               </div>
             )}
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="animate-scale-in space-y-6 sm:space-y-8">
           <div className="sys-card p-6 sm:p-12">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-12">
               <h3 className="text-2xl sm:text-4xl font-black tracking-tighter whitespace-nowrap">Training Flow</h3>
               <div className="flex flex-col items-end gap-4">
                 <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs font-black uppercase tracking-widest text-sepia"><div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-sepia rounded-full" />Daily Minutes</div>
                 <Tabs 
                    tabs={['week', 'month', 'year']} 
                    activeTab={reportView} 
                    onChange={(v) => setReportView(v as any)} 
                    size="sm"
                  />
               </div>
             </div>
             <div className="h-[250px] sm:h-[350px] w-full mt-8">
               <ResponsiveContainer>
                 <BarChart data={workoutReports[reportView]} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                   <CartesianGrid vertical={false} stroke="rgba(232,224,208,0.08)" strokeDasharray="3 3" />
                   <XAxis dataKey="name" tick={{ fill: 'var(--ink)', opacity: 0.4, fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} dy={10} />
                   <YAxis 
                     tick={{ fill: 'var(--ink)', opacity: 0.4, fontSize: 10, fontWeight: 700 }} 
                     axisLine={false} tickLine={false} 
                     width={35}
                     domain={[0, (dataMax: number) => {
                       let target = 30;
                       if (reportView === 'month') target = 210;
                       if (reportView === 'year') target = 900;
                       return Math.max(dataMax, target);
                     }]}
                   />
                   <Tooltip cursor={{ fill: 'rgba(124,169,130,0.06)' }} content={<ChartTooltip unit="min" getTipMessage={(val) => {
                     let target = 30;
                     if (reportView === 'month') target = 210;
                     if (reportView === 'year') target = 900;
                     return val >= target ? 'Peak Performance' : 'Keep Pushing';
                   }} />} />
                   <Bar dataKey="minutes" fill="var(--sepia)" radius={[4, 4, 0, 0]} maxBarSize={40}>
                     {workoutReports[reportView].map((_: any, i: number) => (
                       <Cell key={i} fillOpacity={0.9} />
                     ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};
