import React, { useState } from 'react';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { BackBtn } from '../layout/Common';
import { Card, Button, Label } from '../ui/UIComponents';
import { Droplets, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

interface WaterProps {
  navigate: (to: string) => void;
}

// Base structure for reports, we will dynamically inject today's data into it
const BASE_REPORTS = {
  week: [
    { name: 'Mon', glasses: 0 }, { name: 'Tue', glasses: 0 }, { name: 'Wed', glasses: 0 },
    { name: 'Thu', glasses: 0 }, { name: 'Fri', glasses: 0 }, { name: 'Sat', glasses: 0 }, { name: 'Sun', glasses: 0 }
  ],
  month: [
    { name: 'Week 1', glasses: 0 }, { name: 'Week 2', glasses: 0 }, { name: 'Week 3', glasses: 0 }, { name: 'Week 4', glasses: 0 }
  ],
  year: [
    { name: 'Jan', glasses: 0 }, { name: 'Feb', glasses: 0 }, { name: 'Mar', glasses: 0 }, { name: 'Apr', glasses: 0 },
    { name: 'May', glasses: 0 }, { name: 'Jun', glasses: 0 }, { name: 'Jul', glasses: 0 }
  ]
};

export const Water: React.FC<WaterProps> = ({ navigate }) => {
  const [glasses, setGlasses] = useFirebaseSync<number>('hydration_glasses', 0);
  const [log, setLog] = useFirebaseSync<string[]>('hydration_log', []);
  const [lastDate, setLastDate] = useFirebaseSync<string>('hydration_last_date', new Date().toDateString());
  const [history, setHistory] = useFirebaseSync<Record<string, number>>('hydration_history', {});
  const [reportView, setReportView] = useState<'week' | 'month' | 'year'>('week');
  const goal = 8;
  
  React.useEffect(() => {
    document.title = 'Rakeeen - Water';
  }, []);

  // 12:00 AM Midnight Reset Logic
  React.useEffect(() => {
    const checkMidnight = () => {
      const todayStr = new Date().toDateString();
      if (todayStr !== lastDate) {
        // A new day has started (passed 12:00 AM)
        if (glasses > 0) {
          // Archive yesterday's data
          setHistory({ ...history, [lastDate]: glasses });
        }
        // Reset for the new day
        setGlasses(0);
        setLog([]);
        setLastDate(todayStr);
      }
    };

    checkMidnight(); // Check on mount
    const interval = setInterval(checkMidnight, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [lastDate, glasses, history, setHistory, setGlasses, setLog, setLastDate]);

  const addGlass = () => {
    // 12-hour format
    const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    setLog([...log, now]);
    setGlasses(glasses + 1);
  };

  const reset = () => {
    setGlasses(0);
    setLog([]);
  };

  const pct = Math.min((glasses / goal) * 100, 100);

  // Dynamically generate report data based on current state
  const now = new Date();
  const dayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon, 6=Sun
  const weekIndex = Math.floor(now.getDate() / 7);
  const monthIndex = now.getMonth();

  const dynamicReports = {
    week: BASE_REPORTS.week.map((d, i) => i === dayIndex ? { ...d, glasses: glasses } : d),
    month: BASE_REPORTS.month.map((d, i) => i === Math.min(weekIndex, 3) ? { ...d, glasses: glasses } : d),
    year: BASE_REPORTS.year.map((d, i) => i === monthIndex ? { ...d, glasses: glasses } : d),
  };

  // Helper for generating tips based on goal achievement
  const getTip = (value: number, type: string) => {
    let target = goal;
    if (type === 'month') target = goal * 7;
    if (type === 'year') target = goal * 30;

    if (value === target) return "Perfect!";
    if (value > target) return "Refreshed!";
    return "Keep drinking";
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const val = payload[0].value;
      return (
        <div className="bg-[var(--paper-dark)] border-2 border-[var(--ink)] shadow-[4px_4px_0px_0px_var(--ink)] p-4 rounded-[var(--radius-btn)]">
          <p className="text-[var(--ink)] font-black text-xl">{label}</p>
          <p className="text-[var(--forest)] font-bold text-sm mt-1">{val} Glasses</p>
          <p className="text-[10px] text-[var(--ink)] opacity-50 uppercase tracking-widest mt-2 font-black">{getTip(val, reportView)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-5">
      <BackBtn onClick={()=>navigate('home')} />
      
      <header className="mb-10">
        <h2 className="text-4xl font-black text-ink mb-1">Water</h2>
        <p className="text-[10px] text-ink/40 tracking-[0.2em] font-black">Daily water intake tracker</p>
      </header>

      {/* Main Card (Non-interactive hover, removed 'variant="sketchy"') */}
      <div className="text-center mb-10 overflow-hidden border-2 border-ink rounded-[var(--radius-btn)] bg-paper-dark shadow-[4px_4px_0px_0px_rgba(232,224,208,0.05)] p-8">
        <div className="relative py-6">
          <div className="text-8xl font-black text-sepia leading-none">{glasses}</div>
          <div className="text-[10px] text-ink/30 uppercase tracking-[0.2em] font-black mt-2">of {goal} glasses today</div>
        </div>

        {/* Progress Bar */}
        <div className="h-3 w-full bg-[var(--paper)] rounded-full mb-10 relative overflow-hidden border border-[var(--ink)] opacity-80">
          <div 
            className="h-full bg-[var(--forest)] transition-all duration-700 ease-out" 
            style={{ width: `${pct}%` }} 
          />
        </div>

        {/* Visual Glasses Grid with Fill Animation */}
        <div className="flex gap-3 justify-center mb-10 flex-wrap">
          {Array.from({length:goal}).map((_,i)=>(
            <div key={i} className={`relative w-6 h-9 border-2 overflow-hidden transition-all duration-500 ${i < glasses ? 'border-[var(--forest)]' : 'border-[var(--ink)] opacity-20'}`} style={{ borderRadius: '4px 4px 10px 10px' }}>
               {/* Fill element sliding up from bottom */}
               <div 
                 className="absolute bottom-0 left-0 w-full bg-[var(--forest)] transition-all duration-700 ease-out" 
                 style={{ height: i < glasses ? '100%' : '0%' }} 
               />
            </div>
          ))}
        </div>

        {/* Log Buttons */}
        <div className="flex gap-4 justify-center">
          <Button variant="premium" onClick={addGlass} className="flex items-center justify-center min-w-[220px]">
            <Droplets size={20} className="text-[var(--forest)] mr-3" />
            <span className="tracking-wider font-black pt-1">+ Log glass</span>
          </Button>
          {glasses > 0 && (
            <Button variant="sketchy" onClick={reset} className="px-5 border-ink/20 opacity-50 hover:opacity-100 hover:border-rust hover:text-rust">
              <RefreshCw size={18} />
            </Button>
          )}
        </div>
      </div>

      {/* Today's Log */}
      <div className="bg-[var(--paper)]/30 mb-10 overflow-hidden border-2 border-[var(--ink)] rounded-[var(--radius-btn)] shadow-[4px_4px_0px_0px_rgba(232,224,208,0.05)] p-8">
        <h2 className="text-3xl font-bold tracking-tight mb-8">Today's log</h2>
        {log.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {log.map((t, i)=>(
              <div key={i} className="flex items-center gap-2 bg-[var(--forest)]/10 border-2 border-[var(--forest)] px-4 py-2 rounded-xl animate-scale-in">
                <Droplets size={14} className="text-[var(--forest)]" />
                <span className="text-xs font-black tracking-widest text-[var(--forest)]">{t}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--ink)] opacity-40 text-sm font-bold">No glasses logged yet today. Drink up!</p>
        )}
      </div>

      {/* Water Reports Section */}
      <div className="bg-[var(--paper)]/30 pb-4 overflow-hidden border-2 border-[var(--ink)] rounded-[var(--radius-btn)] shadow-[4px_4px_0px_0px_rgba(232,224,208,0.05)] p-8">
        <h2 className="text-3xl font-bold tracking-tight mb-8">Water reports</h2>
        <div className="flex justify-end gap-3 mb-8 -mt-16 relative z-10">
          {(['week', 'month', 'year'] as const).map(v => (
             <button 
               key={v} 
               onClick={() => setReportView(v)}
               className={`text-[10px] uppercase tracking-widest font-black px-5 py-2 rounded-full border-2 transition-all duration-300 ${reportView === v ? 'border-[var(--forest)] text-[var(--paper)] bg-[var(--forest)]' : 'border-[var(--ink)] text-[var(--ink)] opacity-40 hover:opacity-100 hover:border-[var(--forest)]'}`}
             >
               {v}
             </button>
          ))}
        </div>

        <div className="h-[250px] w-full mt-4">
          <ResponsiveContainer>
            <BarChart data={dynamicReports[reportView]} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(232,224,208,0.05)" />
              <XAxis dataKey="name" tick={{fill:'var(--ink)',opacity:0.4,fontSize:10,fontWeight:700}} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={{fill:'var(--ink)',opacity:0.4,fontSize:10,fontWeight:700}} axisLine={false} tickLine={false} />
              <Tooltip cursor={{fill:'rgba(124,169,130,0.05)'}} content={<CustomTooltip />} />
              
              {/* Reference line showing the goal depending on view */}
              <ReferenceLine 
                y={reportView === 'week' ? goal : reportView === 'month' ? goal * 7 : goal * 30} 
                stroke="var(--forest)" 
                strokeDasharray="5 5" 
                strokeOpacity={0.4} 
              />
              
              <Bar dataKey="glasses" fill="var(--forest)" radius={[4,4,0,0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
