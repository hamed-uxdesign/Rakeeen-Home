import React, { useState } from 'react';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { BackBtn } from '../layout/Common';
import { Button, PageHeader, ChartTooltip } from '../ui/UIComponents';
import { Tabs } from '../ui/Tabs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from 'recharts';
import { HugeiconsIcon } from '@hugeicons/react';
import { 
  DropletIcon, 
  RefreshIcon, 
  ArrowTurnBackwardIcon 
} from '@hugeicons/core-free-icons';

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

  React.useEffect(() => {
    // Client-side reset logic handled by CalendarResetManager
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

  const pct = Math.min((glasses / goal) * 100, 100);

  // --- ANALYTICS: Current period only. No cross-period accumulation. ---
  const getDynamicReports = () => {
    const now = new Date();
    const todayStr = now.toDateString();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDayIdx = now.getDay(); // 0=Sun

    // ── WEEK: Sat-Fri of THIS calendar week only ──────────────────────────────
    const weekDays = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const weekData = weekDays.map((name, i) => {
      const targetDayIdx = [6, 0, 1, 2, 3, 4, 5][i];
      const date = new Date(now);
      date.setDate(now.getDate() - ((currentDayIdx - targetDayIdx + 7) % 7));
      const dateStr = date.toDateString();
      const isFuture = date > now && dateStr !== todayStr;
      if (isFuture) return { name, glasses: 0 };
      if (dateStr === todayStr) return { name, glasses };
      return { name, glasses: history[dateStr] || 0 };
    });

    // ── MONTH: Week 1-4 of THIS calendar month only ───────────────────────────
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

    // ── YEAR: Jan-Dec of THIS calendar year only ──────────────────────────────
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
    <div className="max-w-2xl mx-auto py-6 sm:py-12 px-4 sm:px-6 min-h-screen">
      <BackBtn onClick={() => navigate('home')} />

      <PageHeader 
        title="Water" 
        subtitle="Daily intake tracker" 
      />

      <div className="text-center mb-8 sm:mb-12 sys-card p-6 sm:p-10">
        <div className="relative py-6 sm:py-8">
          <div className="text-[80px] sm:text-[120px] font-black text-sepia leading-none tracking-tighter">{glasses}</div>
          <div className="text-[10px] sm:text-xs text-ink/30 uppercase tracking-[0.3em] font-black mt-2 sm:mt-4">of {goal} glasses today</div>
        </div>

        <div 
          className="h-4 w-full bg-paper rounded-none mb-12 relative overflow-hidden border-2 transition-all duration-500"
          style={{ borderColor: glasses > 0 ? 'var(--forest)' : 'var(--ink)' }}
        >
          <div 
            className="h-full transition-all duration-1000 ease-out" 
            style={{ width: `${pct}%`, backgroundColor: 'var(--forest)' }} 
          />
        </div>

        <div className="flex gap-2 sm:gap-4 justify-center mb-8 sm:mb-12 flex-wrap">
          {Array.from({ length: goal }).map((_, i) => (
            <div 
              key={i} 
              className="relative w-6 h-10 sm:w-8 sm:h-12 border-2 overflow-hidden transition-all duration-700" 
              style={{ 
                borderRadius: '4px 4px 12px 12px', 
                borderColor: i < glasses ? 'var(--forest)' : 'var(--ink)',
                opacity: i < glasses ? 1 : 0.1
              }}
            >
              <div 
                className="absolute bottom-0 left-0 w-full transition-all duration-1000 ease-out" 
                style={{ height: i < glasses ? '100%' : '0%', backgroundColor: 'var(--forest)' }} 
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Button variant="premium" onClick={addGlass} className="flex items-center justify-center w-full sm:w-auto min-w-[200px] h-14 group">
            <HugeiconsIcon icon={DropletIcon} size={22} className="text-forest mr-3 group-hover:text-paper transition-colors" />
            <span className="tracking-[0.2em] font-black uppercase text-sm">+ Log Glass</span>
          </Button>
          {glasses > 0 && (
            <div className="flex gap-2 w-full sm:w-auto justify-center">
              <Button variant="sketchy" onClick={undo} className="flex-1 sm:flex-none px-5 h-14 border-ink/20 opacity-60 hover:opacity-100 hover:border-rust hover:text-rust transition-all">
                <HugeiconsIcon icon={ArrowTurnBackwardIcon} size={20} />
              </Button>
              <Button variant="sketchy" onClick={reset} className="flex-1 sm:flex-none px-5 h-14 border-ink/20 opacity-30 hover:opacity-100 hover:border-rust hover:text-rust transition-all">
                <HugeiconsIcon icon={RefreshIcon} size={20} />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="sys-card mb-8 sm:mb-12 p-6 sm:p-10">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tighter mb-8 sm:mb-10 text-ink">Timeline</h2>
        {log.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {log.map((t, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2 border-2 transition-all animate-scale-in" 
                style={{ borderColor: 'var(--forest)', backgroundColor: 'transparent' }}>
                <HugeiconsIcon icon={DropletIcon} size={13} style={{ color: 'var(--forest)' }} />
                <span className="text-xs font-black tracking-widest tabular-nums" style={{ color: 'var(--forest)' }}>{t}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink/20 text-sm font-black uppercase tracking-[0.3em]">No hydration logged yet.</p>
        )}
      </div>



      <div className="sys-card pb-6 p-6 sm:p-10">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tighter mb-8 sm:mb-12 text-ink">Analytics</h2>
        <Tabs 
          tabs={['week', 'month', 'year']} 
          activeTab={reportView} 
          onChange={(v) => setReportView(v as any)} 
          className="flex-wrap sm:justify-end mb-8 sm:mb-10 sm:-mt-20 gap-2"
        />

        <div className="h-[320px] w-full mt-10">
          <ResponsiveContainer>
            <BarChart data={dynamicReports[reportView]} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(232,224,208,0.08)" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fill: 'var(--ink)', opacity: 0.4, fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis 
                tick={{ fill: 'var(--ink)', opacity: 0.4, fontSize: 10, fontWeight: 700 }} 
                axisLine={false} tickLine={false} 
                width={35}
                domain={[0, (dataMax: number) => {
                  const target = reportView === 'week' ? 14 : reportView === 'month' ? 98 : 420;
                  return Math.max(dataMax, target + (reportView === 'year' ? 40 : 4));
                }]}
                ticks={
                  reportView === 'week' ? [0, 4, 8, 12, 14, 16] : 
                  reportView === 'month' ? [0, 25, 50, 75, 98, 120] :
                  [0, 100, 200, 300, 420, 500]
                }
              />
              <Tooltip cursor={{ fill: 'rgba(124,169,130,0.06)' }} content={<ChartTooltip unit="Glasses" getTipMessage={(val) => val >= (reportView === 'week' ? 14 : reportView === 'month' ? 98 : 420) ? 'Goal Achieved' : 'Hydration Pending'} />} />
              
              <ReferenceLine 
                y={reportView === 'week' ? 14 : reportView === 'month' ? 98 : 420} 
                stroke="var(--forest)" 
                strokeDasharray="6 6" 
                strokeOpacity={0.5} 
                strokeWidth={2}
                label={{ 
                  value: reportView === 'week' ? '14' : reportView === 'month' ? '98' : '420', 
                  position: 'insideTopRight', 
                  fill: 'var(--forest)', 
                  fontSize: 10, 
                  fontWeight: 900,
                  opacity: 0.5
                }} 
              />

              <Bar dataKey="glasses" fill="var(--forest)" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {dynamicReports[reportView].map((_: any, i: number) => (
                  <Cell key={i} fillOpacity={0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
