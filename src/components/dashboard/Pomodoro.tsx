import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import { formatTime } from '../../utils/timeHelpers';
import { ChartTooltip } from '../ui/UIComponents';
import { Play, Pause, RotateCcw, Maximize2, X, ArrowLeft, ChevronRight } from 'lucide-react';
import { usePomodoro } from '../../hooks/usePomodoro';
import { DMTimer, WavyProgressBar } from '../ui/TimerComponents';


interface PomodoroProps {
  navigate: (to: string) => void;
}



const getTip = (value: number, type: string, reportType: 'sessions' | 'minutes') => {
  let target = reportType === 'sessions' ? 25 : 12;
  if (type === 'month') target *= 7;
  if (type === 'year') target *= 30;
  if (value >= target) return "Elite Focus!";
  if (value >= target * 0.7) return "Almost there!";
  return "Keep pushing";
};

// ─── Wavy Timer Ring (Matches user screenshot: smooth left, wavy right, split with top/bottom gaps) ───
export const WavyRing: React.FC<{
  pct: number;
  phase: number;
  mode: 'focus' | 'break';
  isOvertime: boolean;
  size?: number;
  waves: number;
  isFloating?: boolean;
}> = ({ pct, phase, mode, isOvertime, size = 300, waves, isFloating = false }) => {
  const half = size / 2;
  const baseR = half * 0.82;
  const gapOffset = 0.08; // Small gap at top/bottom

  // Right path (wavy): -Math.PI/2 + gapOffset to Math.PI/2 - gapOffset
  const generateWavyRightPath = (offset: number, limitPct: number = 100) => {
    const amplitude = size * (waves > 40 ? 0.015 : 0.02), points = 250;
    const pathPoints: string[] = [];
    const startAngle = -Math.PI / 2 + gapOffset;
    const endAngle = Math.PI / 2 - gapOffset;
    const diff = (endAngle - startAngle) * (limitPct / 100);
    for (let i = 0; i <= points; i++) {
      const angle = startAngle + (i / points) * diff;
      const wave = Math.sin(angle * waves + offset) * amplitude;
      const r = baseR + wave;
      const x = half + r * Math.cos(angle);
      const y = half + r * Math.sin(angle);
      pathPoints.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(3)} ${y.toFixed(3)}`);
    }
    return pathPoints.join(' ');
  };

  // Left path (smooth): sweeps from bottom to top
  const generateSmoothLeftPath = (limitPct: number = 100) => {
    const points = 250;
    const pathPoints: string[] = [];
    const startLeftAngle = Math.PI / 2 + gapOffset;
    const endLeftAngle = Math.PI * 1.5 - gapOffset;
    const diff = (endLeftAngle - startLeftAngle) * (limitPct / 100);
    for (let i = 0; i <= points; i++) {
      const angle = startLeftAngle + (i / points) * diff;
      const x = half + baseR * Math.cos(angle);
      const y = half + baseR * Math.sin(angle);
      pathPoints.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(3)} ${y.toFixed(3)}`);
    }
    return pathPoints.join(' ');
  };

  // Right represents 0-50% progress, left represents 50-100% progress
  const rightPct = Math.min(100, (pct / 50) * 100);
  const leftPct = Math.max(0, ((pct - 50) / 50) * 100);

  const rightTrackPath = generateWavyRightPath(phase, 100);
  const leftTrackPath = generateSmoothLeftPath(100);
  const rightProgressPath = generateWavyRightPath(phase, rightPct);
  const leftProgressPath = generateSmoothLeftPath(leftPct);

  const strokeColor = isOvertime 
    ? 'var(--pomo-overtime)' 
    : (mode === 'break' ? 'var(--pomo-break)' : 'var(--pomo-focus)');

  return (
    <svg viewBox={`0 0 ${size} ${size}`}
      className="block overflow-visible w-full h-full"
      style={{ maxWidth: '100%', maxHeight: '100%' }}
      shapeRendering="geometricPrecision"
    >
      {/* Background Tracks */}
      <path d={rightTrackPath} fill="none" stroke="var(--ink)" strokeWidth={size * 0.015} className="opacity-[0.04]" vectorEffect="non-scaling-stroke" />
      <path d={leftTrackPath} fill="none" stroke="var(--ink)" strokeWidth={size * 0.015} className="opacity-[0.04]" vectorEffect="non-scaling-stroke" />

      {/* Right Progress Ring (Wavy, Dark Green) */}
      {rightPct > 0 && (
        <path
          d={rightProgressPath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={size * 0.024}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Left Progress Ring (Smooth, Light Green) */}
      {leftPct > 0 && (
        <path
          d={leftProgressPath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={size * 0.024}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const Pomodoro: React.FC<PomodoroProps> = ({ navigate }) => {
  const {
    timeLeft, overtime, isOvertime, running, mode, sessions, weekStats, history, todayIdx,
    focusDuration, breakDuration, setFocusDuration, setBreakDuration,
    start, pause, reset, startBreak, startNewSession, skipBreak, saveProgress
  } = usePomodoro();

  const [view, setView] = React.useState<'week' | 'month' | 'year'>('week');
  const [phase, setPhase] = React.useState(0);
  const [smoothRingPct, setSmoothRingPct] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [normalVisible, setNormalVisible] = React.useState(true);
  const [pomTab, setPomTab] = React.useState<'focus' | 'analysis'>('focus');
  const baselinePctRef = React.useRef(0);
  const baselineTimeRef = React.useRef(Date.now());

  // Declare early so useEffects below can reference them
  const FOCUS_S = focusDuration * 60;
  const BREAK_S = breakDuration * 60;
  const pct = isOvertime ? 100 : (mode === 'focus'
    ? ((FOCUS_S - timeLeft) / FOCUS_S) * 100
    : ((BREAK_S - timeLeft) / BREAK_S) * 100
  );

  useEffect(() => { document.title = 'Rakeeen - Pomodoro'; }, []);

  // Update baseline when pct ticks (once per second)
  useEffect(() => {
    baselinePctRef.current = pct;
    baselineTimeRef.current = Date.now();
  }, [pct]);

  // Wave animation + smooth ring pct interpolation
  useEffect(() => {
    let animId: number;
    const animate = () => {
      setPhase(p => (p + 0.05) % (Math.PI * 2));
      if (running && !isOvertime) {
        const elapsed = (Date.now() - baselineTimeRef.current) / 1000;
        const totalSecs = mode === 'focus' ? FOCUS_S : BREAK_S;
        setSmoothRingPct(Math.min(baselinePctRef.current + (elapsed / totalSecs) * 100, 100));
      } else {
        setSmoothRingPct(pct);
      }
      animId = requestAnimationFrame(animate);
    };
    if (running || isOvertime) animId = requestAnimationFrame(animate);
    else setSmoothRingPct(pct);
    return () => cancelAnimationFrame(animId);
  }, [running, isOvertime, FOCUS_S, BREAK_S, mode, pct]);

  // Sync React state with browser fullscreen API + hide body scroll in fullscreen
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        setNormalVisible(true); // browser fully exited — safe to show page
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (isFullscreen) {
      html.style.overflow = 'hidden';
      html.style.scrollbarGutter = 'auto';
    } else {
      html.style.overflow = '';
      html.style.scrollbarGutter = '';
    }
    return () => {
      html.style.overflow = '';
      html.style.scrollbarGutter = '';
    };
  }, [isFullscreen]);

  const enterFullscreen = async () => {
    setNormalVisible(false);
    setIsFullscreen(true);
    try { await document.documentElement.requestFullscreen(); } catch {}
  };

  const exitFullscreen = () => {
    setIsFullscreen(false);
    // browser fullscreen exits in onExitComplete, after animation finishes
  };

  const getTimerColor = () => {
    if (isOvertime) return 'var(--pomo-overtime)';
    if (mode === 'break') return 'var(--pomo-break)';
    return 'var(--ink)';
  };

  const getDynamicReports = () => {
    const now = new Date();
    const todayStr = now.toDateString();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const focusMinsToday = Math.round(weekStats?.[todayIdx]?.minutes || 0);

    // WEEK
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
      
      if (isFuture) return { name, sessions: 0, minutes: 0 };
      if (dateStr === todayStr) return { name, sessions, minutes: focusMinsToday };
      
      const hEntry = history[dateStr];
      return { 
        name,
        sessions: hEntry?.sessions || 0,
        minutes: hEntry?.minutes || 0
      };
    });

    // MONTH
    const monthData = [
      { name: 'Week 1', sessions: 0, minutes: 0 },
      { name: 'Week 2', sessions: 0, minutes: 0 },
      { name: 'Week 3', sessions: 0, minutes: 0 },
      { name: 'Week 4', sessions: 0, minutes: 0 },
    ];
    Object.entries(history).forEach(([dateStr, val]) => {
      const d = new Date(dateStr);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear && dateStr !== todayStr) {
        const weekIdx = Math.min(Math.floor((d.getDate() - 1) / 7), 3);
        monthData[weekIdx].sessions += (val.sessions || 0);
        monthData[weekIdx].minutes += (val.minutes || 0);
      }
    });
    const todayWeekIdx = Math.min(Math.floor((now.getDate() - 1) / 7), 3);
    monthData[todayWeekIdx].sessions += sessions;
    monthData[todayWeekIdx].minutes += focusMinsToday;

    // YEAR
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const yearData = monthNames.map(name => ({ name, sessions: 0, minutes: 0 }));
    Object.entries(history).forEach(([dateStr, val]) => {
      const d = new Date(dateStr);
      if (d.getFullYear() === currentYear && dateStr !== todayStr) {
        yearData[d.getMonth()].sessions += (val.sessions || 0);
        yearData[d.getMonth()].minutes += (val.minutes || 0);
      }
    });
    yearData[currentMonth].sessions += sessions;
    yearData[currentMonth].minutes += focusMinsToday;

    return { week: weekData, month: monthData, year: yearData };
  };

  const dynamicReports = getDynamicReports();
  const [reportType, setReportType] = useState<'sessions' | 'minutes'>('sessions');
  const DAILY_TARGET_HOURS = 12;

  const controls = (
    <div className="flex flex-col items-center gap-4">
      <div className="flex justify-center items-center gap-3">
        {isOvertime || (mode === 'break' && timeLeft === 0) ? (
          <button 
            onClick={isOvertime ? startBreak : startNewSession} 
            className="btn-brutalist min-w-[180px] py-3 text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>{isOvertime ? 'Take a break' : 'Start new session'}</span>
          </button>
        ) : (
          <>
            <button 
              onClick={running ? pause : start}
              className="w-12 h-12 border border-ink flex items-center justify-center transition-all bg-[var(--ink)] text-[var(--paper)] hover:opacity-90 cursor-pointer animate-none"
              title={running ? 'Pause' : 'Start'}
            >
              {running ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button 
              onClick={reset}
              className="w-12 h-12 border border-ink/20 flex items-center justify-center text-ink/30 hover:border-ink/60 hover:text-ink/60 transition-all cursor-pointer bg-transparent"
              title="Reset"
            >
              <RotateCcw size={18} />
            </button>
          </>
        )}
        
        {mode === 'focus' && running && !isOvertime && (
          <button 
            onClick={saveProgress}
            className="text-[10px] uppercase font-black tracking-widest text-forest/40 hover:text-forest transition-all border-b border-forest/20 ml-2 cursor-pointer"
          >
            Done
          </button>
        )}
      </div>
      {mode === 'break' && (
        <button onClick={skipBreak} className="text-[10px] uppercase tracking-[0.2em] font-black text-ink/40 hover:text-sepia transition-all underline underline-offset-4 cursor-pointer">
          Skip Break
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Fullscreen Overlay */}
      <AnimatePresence onExitComplete={() => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
          // normalVisible will be set by fullscreenchange when browser fully exits
        } else {
          setNormalVisible(true); // not in browser fullscreen — show immediately
        }
      }}>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="fixed inset-0 z-[200] bg-[var(--bg)]"
          >
            <button
              onClick={exitFullscreen}
              className="absolute top-6 right-6 w-10 h-10 border border-ink/15 flex items-center justify-center text-ink/30 hover:border-ink/60 hover:text-ink/60 transition-all cursor-pointer z-10"
            >
              <X size={20} />
            </button>

            <div className="w-full h-full flex flex-col items-center justify-center">
              {/* Status label */}
              <div className="text-[10px] uppercase tracking-[0.5em] font-black mb-10" style={{ color: getTimerColor() }}>
                {isOvertime ? '● OVERTIME' : `● ${mode.toUpperCase()}`}
              </div>

              {/* DMTimer */}
              {(() => {
                const timeStr = isOvertime ? formatTime(overtime) : formatTime(timeLeft);
                const [mmStr, ssStr] = timeStr.split(':');
                return (
                  <DMTimer
                    mm={mmStr}
                    ss={ssStr}
                    color={getTimerColor()}
                    maxWidth="min(90vw, 680px)"
                  />
                );
              })()}

              {/* WavyProgressBar */}
              <div className="w-full max-w-[680px] mt-10 px-4">
                <WavyProgressBar pct={pct} isOvertime={isOvertime} mode={mode} running={running} totalSecs={mode === 'focus' ? FOCUS_S : BREAK_S} />
              </div>

              {/* Controls — play/pause + reset */}
              <div className="mt-10 flex items-center gap-4">
                <button
                  onClick={running ? pause : start}
                  className="w-14 h-14 border border-ink flex items-center justify-center bg-[var(--ink)] text-[var(--paper)] hover:opacity-90 transition-all cursor-pointer"
                >
                  {running ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <button
                  onClick={reset}
                  className="w-14 h-14 border border-ink/20 flex items-center justify-center text-ink/30 hover:border-ink/60 hover:text-ink/60 transition-all cursor-pointer bg-transparent"
                >
                  <RotateCcw size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Normal View */}
      <div className={`min-h-screen bg-bg text-ink py-12 px-6 md:px-12 lg:px-20 font-sans-main flex flex-col transition-colors duration-300 ${normalVisible ? '' : 'invisible'}`}>
        
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
            <span className="font-mono-main text-[10px] uppercase tracking-[0.25em] font-bold text-ink/50">Focus</span>
          </div>

          <div className="flex flex-col">
            <h1 className="font-sans-main text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-ink">
              FOCUS TIME
            </h1>
          </div>
        </header>

        {/* TABS */}
        <div className="w-full max-w-[1000px] mx-auto mb-6">
          <div className="flex border border-ink/20 overflow-hidden relative bg-[var(--paper-dark)] w-fit">
            {(['focus', 'analysis'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setPomTab(tab)}
                className="relative font-mono-main text-[10px] uppercase tracking-widest font-bold px-6 py-2.5 cursor-pointer transition-colors duration-200"
                style={{ color: pomTab === tab ? 'var(--paper)' : 'var(--ink)' }}
              >
                {pomTab === tab && (
                  <motion.div
                    layoutId="pomTabBg"
                    className="absolute inset-0 bg-[var(--ink)]"
                    transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                    style={{ zIndex: 0 }}
                  />
                )}
                <span className="relative z-10">{tab === 'focus' ? 'Focus Time' : 'Analysis'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <main className="w-full max-w-[1000px] mx-auto flex flex-col gap-6">

          {/* Focus Session Card */}
          {pomTab === 'focus' && (
          <div className="text-center brutalist-card no-lift relative p-6 sm:p-10">

            {/* Fullscreen Button */}
            <button
              onClick={enterFullscreen}
              className="absolute top-4 right-4 w-8 h-8 border border-ink/20 flex items-center justify-center text-ink/30 hover:border-ink/60 hover:text-ink/60 transition-all cursor-pointer bg-transparent"
              title="Fullscreen"
            >
              <Maximize2 size={14} />
            </button>

            <div className="text-[10px] uppercase tracking-[0.3em] font-black mb-10">
              <span style={{ color: getTimerColor() }}>
                {isOvertime ? 'Over-focusing' : (mode === 'focus' ? 'Focus session' : 'Break time')}
              </span>
            </div>

            {/* Timer Circle */}
            <div className="relative w-full max-w-[300px] aspect-square mx-auto flex items-center justify-center">
              <div className="absolute inset-6 rounded-full blur-[40px] opacity-20 -z-10 transition-colors duration-1000" style={{ backgroundColor: getTimerColor() }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <WavyRing pct={smoothRingPct} phase={phase} mode={mode} isOvertime={isOvertime} size={300} waves={mode === 'focus' ? focusDuration : breakDuration} />
              </div>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl sm:text-5xl font-black mb-1 transition-colors duration-500 text-ink">
                  {isOvertime ? `+${formatTime(overtime)}` : formatTime(timeLeft)}
                </span>
                <span className="text-[10px] tracking-[0.3em] font-bold text-ink/40 uppercase">
                  {isOvertime ? 'Overtime' : mode}
                </span>
              </div>
            </div>

            <div className="relative flex justify-center mt-6 select-none">
              <span className="text-[10px] uppercase tracking-[0.2em] font-black text-ink/30">
                {mode === 'focus' ? `${focusDuration}m focus session` : `${breakDuration}m health break`}
              </span>
            </div>

            {/* Controls */}
            <div className="mt-10">{controls}</div>
          </div>
          )}

          {/* Performance Reports */}
          {pomTab === 'analysis' && (
          <div className="brutalist-card no-lift pb-6 p-6 sm:p-8">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Performance</h2>
                <div className="flex items-center gap-4 mt-2">
                  <span className="font-mono-main text-[10px] font-black text-ink/30 uppercase tracking-widest">
                    {sessions} sessions today
                  </span>
                  <span className="text-ink/15">·</span>
                  <span className="font-mono-main text-[10px] font-black text-ink/30 uppercase tracking-widest">
                    {Number(((weekStats?.[todayIdx]?.minutes || 0) / 60).toFixed(1))}h focus today
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Period switch tab with sliding animation */}
                <div className="flex border border-ink/20 overflow-hidden relative bg-[var(--paper-dark)]">
                  {(['week', 'month', 'year'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className="relative font-mono-main text-[10px] uppercase tracking-widest font-bold px-4 py-2 cursor-pointer transition-colors duration-200"
                      style={{
                        color: view === v ? 'var(--paper)' : 'var(--ink)',
                      }}
                    >
                      {view === v && (
                        <motion.div
                          layoutId="pomodoroPeriodTabBg"
                          className="absolute inset-0 bg-[var(--ink)]"
                          transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                          style={{ zIndex: 0 }}
                        />
                      )}
                      <span className="relative z-10">{v}</span>
                    </button>
                  ))}
                </div>

                {/* Metric switch tab with sliding animation */}
                <div className="flex border border-ink/20 overflow-hidden relative bg-[var(--paper-dark)]">
                  {(['sessions', 'minutes'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setReportType(type)}
                      className="relative font-mono-main text-[10px] uppercase tracking-widest font-bold px-4 py-2 cursor-pointer transition-colors duration-200"
                      style={{
                        color: reportType === type ? 'var(--paper)' : 'var(--ink)',
                      }}
                    >
                      {reportType === type && (
                        <motion.div
                          layoutId="pomodoroMetricTabBg"
                          className="absolute inset-0 bg-[var(--ink)]"
                          transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                          style={{ zIndex: 0 }}
                        />
                      )}
                      <span className="relative z-10">{type === 'sessions' ? 'Sessions' : 'Hrs Focus'}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="h-[240px] w-full">
              <ResponsiveContainer>
                <BarChart 
                  data={dynamicReports[view].map((d: any) => ({ 
                    ...d, 
                    displayHours: Number((d.minutes / 60).toFixed(2))
                  }))} 
                  margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--ink)" strokeOpacity={0.05} strokeDasharray="0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'var(--ink)', opacity: 0.4, fontSize: 10, fontWeight: 700, fontFamily: 'Geist Mono, monospace' }} 
                    axisLine={false} tickLine={false} dy={10} 
                  />
                  <YAxis 
                    tick={{ fill: 'var(--ink)', opacity: 0.4, fontSize: 10, fontWeight: 700, fontFamily: 'Geist Mono, monospace' }} 
                    axisLine={false} tickLine={false}
                    width={35}
                    domain={[0, (dataMax: number) => {
                      let target = reportType === 'sessions' ? 25 : DAILY_TARGET_HOURS;
                      if (view === 'month') target *= 7;
                      if (view === 'year') target *= 30;
                      return Math.max(dataMax, target);
                    }]}
                    ticks={(() => {
                      let base = reportType === 'sessions' ? 25 : 12;
                      if (view === 'month') base *= 7;
                      if (view === 'year') base *= 30;
                      const step = base / 5;
                      return [0, step, step*2, step*3, step*4, base, base + step];
                    })()}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--ink)', fillOpacity: 0.04 }}
                    content={<ChartTooltip unit={reportType === 'sessions' ? 'Sessions' : 'Hours'} getTipMessage={(val) => getTip(val, view, reportType)} />}
                  />
                  
                  <ReferenceLine 
                    y={(() => {
                      let target = reportType === 'sessions' ? 25 : DAILY_TARGET_HOURS;
                      if (view === 'month') target *= 7;
                      if (view === 'year') target *= 30;
                      return target;
                    })()} 
                    stroke="var(--forest)" 
                    strokeDasharray="6 6" 
                    strokeOpacity={0.4}
                    strokeWidth={1.5}
                  />

                  <Bar dataKey={reportType === 'sessions' ? 'sessions' : 'displayHours'} radius={[0, 0, 0, 0]} maxBarSize={32}>
                    {dynamicReports[view].map((_: any, i: number) => (
                      <Cell key={i} fill="var(--sepia)" fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>
          )}
        </main>
      </div>
    </>
  );
};
