import React, { useState } from 'react';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { ChartTooltip } from '../ui/UIComponents';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from 'recharts';
import { RotateCcw, Undo2, Plus, ArrowLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { DotMatrixText } from '../ui/DotMatrixText';

interface WaterProps {
  navigate: (to: string) => void;
}

export const Water: React.FC<WaterProps> = ({ navigate }) => {
  const [glasses, setGlasses] = useFirebaseSync<number>('hydration_glasses', 0);
  const [log, setLog] = useFirebaseSync<string[]>('hydration_log', []);
  const [history] = useFirebaseSync<Record<string, number>>('hydration_history', {});
  const [reportView, setReportView] = useState<'week' | 'month' | 'year'>('week');
  const goal = 14;

  React.useEffect(() => {
    document.title = 'Rakeeen - Water';
  }, []);

  const addGlass = () => {
    const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    setLog([...log, now]);
    setGlasses(glasses + 1);
  };

  const reset = () => {
    setGlasses(0);
    setLog([]);
  };

  const undo = () => {
    if (glasses <= 0) return;
    setGlasses(glasses - 1);
    setLog(log.slice(0, -1));
  };

  // --- ANALYTICS ---
  const getDynamicReports = () => {
    const now = new Date();
    const todayStr = now.toDateString();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const getStartOfWeek = (d: Date): Date => {
      const date = new Date(d);
      const day = date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const diff = (day + 1) % 7; 
      date.setDate(date.getDate() - diff);
      date.setHours(0, 0, 0, 0);
      return date;
    };

    const startOfWeek = getStartOfWeek(now);
    const weekDays = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const weekData = weekDays.map((name, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = date.toDateString();
      const isFuture = date > now && dateStr !== todayStr;
      if (isFuture) return { name, glasses: 0 };
      if (dateStr === todayStr) return { name, glasses };
      return { name, glasses: history[dateStr] || 0 };
    });

    const monthData = [
      { name: 'Week 1', glasses: 0 }, { name: 'Week 2', glasses: 0 },
      { name: 'Week 3', glasses: 0 }, { name: 'Week 4', glasses: 0 }
    ];
    Object.entries(history).forEach(([dateStr, val]) => {
      const d = new Date(dateStr);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear && dateStr !== todayStr) {
        const weekIdx = Math.min(Math.floor((d.getDate() - 1) / 7), 3);
        monthData[weekIdx].glasses += val;
      }
    });
    const todayWeekIdx = Math.min(Math.floor((now.getDate() - 1) / 7), 3);
    monthData[todayWeekIdx].glasses += glasses;

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const yearData = monthNames.map(name => ({ name, glasses: 0 }));
    Object.entries(history).forEach(([dateStr, val]) => {
      const d = new Date(dateStr);
      if (d.getFullYear() === currentYear && dateStr !== todayStr) {
        yearData[d.getMonth()].glasses += val;
      }
    });
    yearData[currentMonth].glasses += glasses;

    return { week: weekData, month: monthData, year: yearData };
  };

  const dynamicReports = getDynamicReports();

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
          <span className="font-mono-main text-[10px] uppercase tracking-[0.25em] font-bold text-ink/50">Water</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-sans-main text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-ink">
              WATER <span className="text-ink/30">INTAKE</span>
            </h1>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="w-full max-w-[1000px] mx-auto flex flex-col gap-6">

        {/* HERO COUNTER CARD - STATIC (no hover lift) */}
        <div className="brutalist-dashed-card no-lift flex flex-col md:flex-row md:items-center md:justify-between gap-10">
          {/* Dot Matrix Counter */}
          <div className="flex-grow flex flex-col sm:flex-row sm:items-center gap-8">
            <div className="flex items-center gap-6">
              <DotMatrixText text={String(glasses)} />
              <div className="flex items-center gap-4 self-end pb-1">
                <span className="font-mono-main text-4xl font-black text-ink/20">/</span>
                {/* Goal 14 in matching dot matrix style */}
                <DotMatrixText 
                  text={String(goal)} 
                  dotSizeClassName="w-1.5 h-1.5 sm:w-2 sm:h-2" 
                  gapClassName="gap-0.5 sm:gap-1" 
                />
              </div>
            </div>
            <span className="font-sans-main text-xs font-bold uppercase tracking-widest text-ink/40">
              glasses today
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 min-w-[180px]">
            <button
              onClick={addGlass}
              className="btn-brutalist flex items-center justify-center gap-2 w-full py-4 text-sm"
            >
              <Plus size={16} strokeWidth={3} />
              Add Glass
            </button>
            <div 
              className={`flex gap-2 transition-all duration-200 ${glasses > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none invisible'}`}
              style={{ visibility: glasses > 0 ? 'visible' : 'hidden' }}
            >
              <button
                onClick={undo}
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-ink/20 text-ink/40 hover:text-ink hover:border-ink transition-all font-mono-main text-[10px] uppercase tracking-widest font-bold"
              >
                <Undo2 size={14} />
                Undo
              </button>
              <button
                onClick={reset}
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-ink/10 text-ink/20 hover:text-ink/60 hover:border-ink/40 transition-all font-mono-main text-[10px] uppercase tracking-widest font-bold"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* ANALYTICS CARD - STATIC (no hover lift) */}
        <div className="brutalist-card no-lift">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
            <h2 className="font-sans-main text-2xl font-black uppercase tracking-tight">Analytics</h2>

            {/* Brutalist Sliding Tab Switcher */}
            <div className="flex border border-ink/20 overflow-hidden self-start relative bg-[var(--paper-dark)]">
              {(['week', 'month', 'year'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setReportView(view)}
                  className="relative font-mono-main text-[10px] uppercase tracking-widest font-bold px-4 py-2 cursor-pointer transition-colors duration-200"
                  style={{
                    color: reportView === view ? 'var(--paper)' : 'var(--ink)',
                  }}
                >
                  {reportView === view && (
                    <motion.div
                      layoutId="waterTabBg"
                      className="absolute inset-0 bg-[var(--ink)]"
                      transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                      style={{ zIndex: 0 }}
                    />
                  )}
                  <span className="relative z-10">{view}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer>
              <BarChart data={dynamicReports[reportView]} margin={{ top: 16, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--ink)" strokeOpacity={0.05} strokeDasharray="0" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--ink)', opacity: 0.3, fontSize: 10, fontWeight: 700, fontFamily: 'Geist Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  tick={{ fill: 'var(--ink)', opacity: 0.3, fontSize: 10, fontWeight: 700, fontFamily: 'Geist Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                  domain={[0, (dataMax: number) => {
                    const target = reportView === 'week' ? 14 : reportView === 'month' ? 98 : 420;
                    return Math.max(dataMax, target + (reportView === 'year' ? 40 : 4));
                  }]}
                  ticks={
                    reportView === 'week' ? [0, 4, 8, 12, 14] :
                    reportView === 'month' ? [0, 25, 50, 75, 98] :
                    [0, 100, 200, 300, 420]
                  }
                />
                <Tooltip
                  cursor={{ fill: 'var(--ink)', fillOpacity: 0.04 }}
                  content={
                    <ChartTooltip
                      unit="Glasses"
                      getTipMessage={(val) =>
                        val >= (reportView === 'week' ? 14 : reportView === 'month' ? 98 : 420)
                          ? 'Goal Achieved'
                          : 'Hydration Pending'
                      }
                    />
                  }
                />
                <ReferenceLine
                  y={reportView === 'week' ? 14 : reportView === 'month' ? 98 : 420}
                  stroke="var(--ink)"
                  strokeOpacity={0.15}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{
                    value: reportView === 'week' ? '14' : reportView === 'month' ? '98' : '420',
                    position: 'insideTopRight',
                    fill: 'var(--ink)',
                    fontSize: 10,
                    fontWeight: 900,
                    opacity: 0.25,
                    fontFamily: 'Geist Mono, monospace',
                  }}
                />
                <Bar dataKey="glasses" maxBarSize={36} radius={[0, 0, 0, 0]}>
                  {dynamicReports[reportView].map((_: any, i: number) => (
                    <Cell
                      key={i}
                      fill="var(--sepia)"
                      fillOpacity={0.9}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Stats Footer */}
          <div className="flex items-center justify-between border-t border-ink/5 pt-5 mt-4">
            <span className="font-mono-main text-[10px] uppercase tracking-widest text-ink/30 font-bold">
              Daily Target: {goal} Glasses
            </span>
            <span className="font-mono-main text-[10px] uppercase tracking-widest text-ink/30 font-bold">
              {reportView === 'week' ? 'This Week' : reportView === 'month' ? 'This Month' : 'This Year'}
            </span>
          </div>
        </div>

      </main>
    </div>
  );
};
