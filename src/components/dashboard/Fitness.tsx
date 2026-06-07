import React, { useState, useEffect } from 'react';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { ChartTooltip } from '../ui/UIComponents';
import { getLogicalDate } from '../../utils/timeHelpers';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { ArrowLeft, ChevronRight, Dumbbell, Trash2, Check, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

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
    setWorkouts([{ id: Date.now().toString(), duration: Number(wDuration), date: getLogicalDate().toDateString(), time: new Date().toLocaleTimeString() }, ...workouts]);
    setWDuration('');
  };
  const deleteWorkout = (id: string) => setWorkouts(workouts.filter(w => w.id !== id));

  const checkInSugar = () => {
    const todayStr = getLogicalDate().toDateString();
    if (sugarChallenge.lastCheckIn === todayStr) return;
    setSugarChallenge({ lastCheckIn: todayStr, completedDays: (sugarChallenge.completedDays || 0) + 1 });
  };
  const resetSugar = () => {
    setSugarChallenge({ lastCheckIn: '', completedDays: 0 });
  };

  useEffect(() => {
    const now = new Date();
    const logicalToday = getLogicalDate();
    const todayStr = logicalToday.toDateString();
    const yesterday = new Date(logicalToday.getTime());
    yesterday.setDate(logicalToday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    if (sugarChallenge.completedDays > 0 && sugarChallenge.completedDays < 21) {
      const last = sugarChallenge.lastCheckIn;
      
      const dayMissed = last && last !== todayStr && last !== yesterdayStr;
      
      const isPastBedtime = nextSleepTime && now >= nextSleepTime;
      const bedtimeMissed = isPastBedtime && last !== todayStr;

      if (dayMissed || bedtimeMissed) {
        setSugarChallenge({ lastCheckIn: '', completedDays: 0 });
      }
    }
  }, [sugarChallenge.completedDays, sugarChallenge.lastCheckIn, setSugarChallenge, nextSleepTime]);

  const isTodayChecked = sugarChallenge.lastCheckIn === getLogicalDate().toDateString();
  const isChallengeDone = sugarChallenge.completedDays >= 21;

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const WORKOUT_DAYS = [0, 3]; // Sun, Wed
  const today = getLogicalDate();
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
  
  const getFallbackLateThreshold = () => {
    const t = new Date(today);
    t.setHours(2, 0, 0, 0);
    if (today.getHours() >= 2) {
      t.setDate(t.getDate() + 1);
    }
    return t;
  };
  
  const lateThreshold = nextSleepTime ? new Date(nextSleepTime.getTime() - 3 * 60 * 60 * 1000) : getFallbackLateThreshold();
  const isLate = today >= lateThreshold;
  const isMissed = isWorkoutDay && isLate && !workoutLoggedToday;

  const getWorkoutReports = () => {
    const todayStr = today.toDateString();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDayIdx = today.getDay();

    // WEEK
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

    // MONTH
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

    // YEAR
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
          <span className="font-mono-main text-[10px] uppercase tracking-[0.25em] font-bold text-ink/50">Training</span>
        </div>

        <div className="flex flex-col">
          <h1 className="font-sans-main text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-ink">
            TRAINING
          </h1>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="w-full max-w-[1000px] mx-auto flex flex-col gap-6">

        {/* Brutalist Tab Switcher with sliding animation */}
        <div className="flex border border-ink/20 overflow-hidden self-start relative bg-[var(--paper-dark)]">
          {(['workout', 'challenge', 'analytics'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setTab(view)}
              className="relative font-mono-main text-[10px] uppercase tracking-widest font-bold px-4 py-2 transition-colors duration-200 cursor-pointer"
              style={{
                color: tab === view ? 'var(--paper)' : 'var(--ink)',
              }}
            >
              {tab === view && (
                <motion.div
                  layoutId="fitnessTabBg"
                  className="absolute inset-0 bg-[var(--ink)]"
                  transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                  style={{ zIndex: 0 }}
                />
              )}
              <span className="relative z-10">{view === 'workout' ? 'Workouts' : view === 'challenge' ? 'No Sugar' : 'Analytics'}</span>
            </button>
          ))}
        </div>

        {tab === 'workout' && (
          <div className="space-y-6">
             <div className={`brutalist-card no-lift p-6 sm:p-12 text-center transition-all duration-500 ${isMissed ? 'bg-rust/10 border-rust border-l-4' : isWorkoutDay && workoutLoggedToday ? 'bg-forest/10 border-forest border-l-4' : 'bg-paper-dark border-ink/5'}`}>
                {isMissed ? (
                  <Zap size={48} className="text-rust mx-auto mb-6 animate-bounce" />
                ) : (
                  <Dumbbell size={48} className={`mx-auto mb-6 ${isWorkoutDay && workoutLoggedToday ? 'text-forest' : 'text-ink/20'}`} />
                )}
                
                <h3 className="text-2xl sm:text-4xl font-black text-ink mb-4 tracking-tighter">
                  {isMissed ? 'ACTION REQUIRED' : isWorkoutDay ? (workoutLoggedToday ? 'PROTOCOL SECURED' : 'TRAINING DAY') : 'RECOVERY PHASE'}
                </h3>
                
                <div className="flex flex-wrap justify-center gap-2 mb-8">
                   {days.map((d, i) => {
                     const isW = WORKOUT_DAYS.includes(i);
                     return (
                       <div key={d} className={`text-[10px] font-black px-3 py-1 border border-ink ${isW ? (i === todayIdx ? 'bg-forest text-paper border-forest' : 'border-forest text-forest') : 'opacity-20 border-transparent'}`}>
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

             <div className="brutalist-card no-lift p-6 sm:p-10">
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-stretch sm:items-end">
                  <div className="flex-1">
                    <label className="block font-mono-main text-[10px] uppercase tracking-widest text-ink/40 mb-2">Duration (Minutes)</label>
                    <input 
                      type="number" 
                      placeholder="60" 
                      value={wDuration} 
                      onChange={e => setWDuration(e.target.value)} 
                      className="w-full bg-[var(--paper-dark)] border border-ink p-4 text-lg font-mono-main focus:outline-none focus:border-forest"
                    />
                  </div>
                  <button 
                    onClick={addWorkout} 
                    className="btn-brutalist px-12 py-4 h-[58px] text-sm cursor-pointer"
                  >
                    Log Session
                  </button>
                </div>
             </div>

          </div>
        )}

        {tab === 'challenge' && (
          <div className="space-y-6">
            <div className={`brutalist-card no-lift p-6 sm:p-12 text-center ${isChallengeDone ? 'bg-forest/5 border-l-4 border-l-forest' : ''}`}>
               <div className="mb-8">
                  <h3 className="text-3xl font-black text-ink mb-2 tracking-tighter">
                    {isChallengeDone ? 'HABIT SECURED' : 'No Sugar'}
                  </h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-forest opacity-60">
                    {isChallengeDone ? 'LIFETIME MAINTENANCE' : 'Discipline Protocol'}
                  </p>
               </div>

               {!isChallengeDone ? (
                 <>
                   <div className="grid grid-cols-7 gap-2 mb-8 max-w-md mx-auto px-2">
                      {Array.from({ length: 21 }).map((_, i) => {
                        const completed = i < sugarChallenge.completedDays;
                        return (
                          <div 
                            key={i} 
                            className="aspect-square border flex items-center justify-center transition-all duration-300"
                            style={{ 
                              backgroundColor: completed ? 'var(--forest)' : 'transparent',
                              borderColor: completed ? 'var(--forest)' : 'var(--ink)',
                              opacity: completed ? 1 : 0.2
                            }}
                          >
                            {completed && (
                              <Check size={16} style={{ color: 'var(--paper)' }} />
                            )}
                          </div>
                        );
                      })}
                   </div>
                   <div className="text-center mb-8">
                      <div className="text-6xl sm:text-[100px] font-black text-forest leading-none tracking-tighter">{sugarChallenge.completedDays}</div>
                      <div className="text-[10px] font-black text-ink/20 uppercase tracking-[0.3em] mt-4">Days Completed / 21</div>
                   </div>
                   <div className="flex flex-col sm:flex-row gap-4">
                      <button 
                        onClick={checkInSugar} 
                        disabled={isTodayChecked} 
                        className="btn-brutalist w-full py-4 text-sm font-mono-main tracking-widest font-black uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isTodayChecked ? 'Day Secured' : 'Log Success'}
                      </button>
                   </div>
                 </>
               ) : (
                 <div className="py-6">
                   <div className="w-24 h-24 bg-forest flex items-center justify-center mx-auto mb-8">
                      <Zap size={48} style={{ color: 'var(--paper)' }} />
                   </div>
                   <p className="text-lg font-black text-ink mb-12 max-w-sm mx-auto leading-relaxed">The 21-day cycle is complete. You are now in the <span className="text-forest">Reward Protocol</span>.</p>
                   <div className="bg-paper p-8 border border-dashed border-forest/30 inline-block">
                      <div className="text-[10px] font-black uppercase tracking-[0.4em] text-ink/30 mb-2">Next Friday Reward</div>
                      <div className="text-2xl font-black text-forest tracking-tighter">SUGAR REWARD UNLOCKED</div>
                   </div>
                   <div className="mt-12">
                      <button onClick={resetSugar} className="text-[10px] font-black uppercase tracking-widest text-ink/20 hover:text-rust transition-all italic cursor-pointer bg-transparent border-0">Reset Challenge (Not Recommended)</button>
                   </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {tab === 'analytics' && (
          <div className="space-y-6">
             <div className="brutalist-card no-lift p-6 sm:p-12">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-12">
                 <h3 className="text-2xl sm:text-4xl font-black tracking-tighter whitespace-nowrap">Training Flow</h3>
                 <div className="flex flex-col items-end gap-4">
                   <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs font-black uppercase tracking-widest text-sepia">
                     <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-sepia rounded-full" />
                     Daily Minutes
                   </div>
                   {/* Period Tab Switch with sliding indicator */}
                   <div className="flex border border-ink/20 overflow-hidden relative bg-[var(--paper-dark)]">
                     {(['week', 'month', 'year'] as const).map((viewOption) => (
                       <button
                         key={viewOption}
                         onClick={() => setReportView(viewOption)}
                         className="relative font-mono-main text-[10px] uppercase tracking-widest font-bold px-4 py-2 transition-colors duration-200 cursor-pointer"
                         style={{
                           color: reportView === viewOption ? 'var(--paper)' : 'var(--ink)',
                         }}
                       >
                         {reportView === viewOption && (
                           <motion.div
                             layoutId="fitnessReportTabBg"
                             className="absolute inset-0 bg-[var(--ink)]"
                             transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                             style={{ zIndex: 0 }}
                           />
                         )}
                         <span className="relative z-10">{viewOption}</span>
                       </button>
                     ))}
                   </div>
                 </div>
               </div>
               <div className="h-[250px] sm:h-[350px] w-full mt-8">
                 <ResponsiveContainer>
                   <BarChart data={workoutReports[reportView]} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                     <CartesianGrid vertical={false} stroke="var(--ink)" strokeOpacity={0.05} strokeDasharray="0" />
                     <XAxis dataKey="name" tick={{ fill: 'var(--ink)', opacity: 0.4, fontSize: 10, fontWeight: 700, fontFamily: 'Geist Mono, monospace' }} axisLine={false} tickLine={false} dy={10} />
                     <YAxis 
                       tick={{ fill: 'var(--ink)', opacity: 0.4, fontSize: 10, fontWeight: 700, fontFamily: 'Geist Mono, monospace' }} 
                       axisLine={false} tickLine={false} 
                       width={35}
                       domain={[0, (dataMax: number) => {
                         let target = 30;
                         if (reportView === 'month') target = 210;
                         if (reportView === 'year') target = 900;
                         return Math.max(dataMax, target);
                       }]}
                     />
                     <Tooltip cursor={{ fill: 'var(--ink)', fillOpacity: 0.04 }} content={<ChartTooltip unit="min" getTipMessage={(val) => {
                       let target = 30;
                       if (reportView === 'month') target = 210;
                       if (reportView === 'year') target = 900;
                       return val >= target ? 'Peak Performance' : 'Keep Pushing';
                     }} />} />
                     <Bar dataKey="minutes" fill="var(--sepia)" radius={[0, 0, 0, 0]} maxBarSize={40}>
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

      </main>
    </div>
  );
};
