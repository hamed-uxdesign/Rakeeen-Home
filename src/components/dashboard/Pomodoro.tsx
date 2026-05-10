import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import { POMODORO_MONTHLY_MOCK, POMODORO_WEEKLY_MOCK } from '../../constants/mockData';
import { formatTime } from '../../utils/timeHelpers';
import { BackBtn } from '../layout/Common';
import { Button, PageHeader, ChartTooltip } from '../ui/UIComponents';
import { Tabs } from '../ui/Tabs';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlayIcon, PauseIcon, RefreshIcon, ArrowExpand01Icon, Cancel01Icon, Delete02Icon } from '@hugeicons/core-free-icons';
import { usePomodoro } from '../../hooks/usePomodoro';

interface PomodoroProps {
  navigate: (to: string) => void;
}

// ─── Duration Editor Popover ───────────────────────────────────────────────────
const DurationEditor: React.FC<{
  focusDuration: number;
  breakDuration: number;
  onSave: (f: number, b: number) => void;
  onClose: () => void;
}> = ({ focusDuration, breakDuration, onSave, onClose }) => {
  const [f, setF] = React.useState(focusDuration);
  const [b, setB] = React.useState(breakDuration);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const numBtn = (value: number, setter: (v: number) => void, delta: number, min: number, max: number) => (
    <button
      onClick={() => setter(Math.min(max, Math.max(min, value + delta)))}
      className="w-8 h-8 border-2 border-ink/20 rounded-[var(--radius-btn)] font-black text-ink/60 hover:border-forest hover:text-forest transition-all text-sm leading-none"
    >
      {delta > 0 ? '+' : '−'}
    </button>
  );

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 w-64 bg-[var(--paper-dark)] border-2 border-ink rounded-[var(--radius-btn)] shadow-[4px_4px_0px_0px_rgba(232,224,208,0.1)] p-5"
    >
      <div className="text-[9px] uppercase tracking-[0.3em] font-black text-ink/40 mb-4">Duration Settings</div>

      {/* Focus Row - Locked as per user request */}
      <div className="flex items-center justify-between mb-3 opacity-40">
        <span className="text-[10px] uppercase tracking-widest font-black text-forest">Focus (Locked)</span>
        <div className="flex items-center gap-2">
          <span className="text-lg font-black text-ink w-10 text-center">{f}m</span>
        </div>
      </div>

      {/* Break Row */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-[10px] uppercase tracking-widest font-black text-sepia">Break</span>
        <div className="flex items-center gap-2">
          {numBtn(b, setB, -1, 1, 60)}
          <span className="text-lg font-black text-ink w-10 text-center">{b}m</span>
          {numBtn(b, setB, 1, 1, 60)}
        </div>
      </div>

      <button
        onClick={() => onSave(f, b)}
        className="w-full py-2 border-2 border-forest text-forest font-black text-[10px] uppercase tracking-[0.3em] rounded-[var(--radius-btn)] hover:bg-forest hover:text-paper transition-all"
      >
        Apply
      </button>
    </motion.div>
  );
};

// Custom tooltip logic moved to ChartTooltip
const getTip = (value: number, type: string) => {
  let target = 8;
  if (type === 'month') target = 8 * 5;
  if (type === 'year') target = 8 * 250;
  if (value >= target) return "Elite Focus!";
  if (value >= target * 0.7) return "Almost there!";
  return "Keep pushing";
};

// ─── Wavy Timer Ring ──────────────────────────────────────────────────────────
export const WavyRing: React.FC<{
  pct: number;
  phase: number;
  mode: 'focus' | 'break';
  isOvertime: boolean;
  running: boolean;
  size?: number;
  waves: number;
}> = ({ pct, phase, mode, isOvertime, running, size = 300, waves }) => {
  const half = size / 2;
  const baseR = half * 0.8;

  const generateWavyPath = (offset: number) => {
    const amplitude = size * 0.02, points = 360;
    const pathPoints: string[] = [];
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2 - Math.PI / 2;
      const wave = Math.sin(angle * waves + offset) * amplitude;
      const r = baseR + wave;
      const x = half + r * Math.cos(angle);
      const y = half + r * Math.sin(angle);
      pathPoints.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(3)} ${y.toFixed(3)}`);
    }
    return pathPoints.join(' ') + ' Z';
  };

  const activeColor = isOvertime ? 'var(--rust)' : (mode === 'focus' ? 'var(--forest)' : 'var(--sepia)');
  const currentPath = generateWavyPath(phase);

  return (
    <svg viewBox={`0 0 ${size} ${size}`}
      className="block overflow-visible w-full h-auto max-w-full"
      style={{ maxWidth: size, maxHeight: size }}
      shapeRendering="geometricPrecision"
    >
      {/* Background Track */}
      <path d={currentPath} fill="none" stroke="var(--bg)" strokeWidth={size * 0.01} className="opacity-20" vectorEffect="non-scaling-stroke" />

      {/* Progress Ring */}
      <path
        d={currentPath}
        fill="none"
        stroke={activeColor}
        strokeWidth={size * 0.017}
        strokeLinecap="round"
        pathLength="1"
        strokeDasharray="1"
        style={{
          strokeDashoffset: 1 - (pct / 100),
          transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.8s ease',
          vectorEffect: 'non-scaling-stroke',
          opacity: pct > 0 ? 1 : 0
        }}
      />

      {/* Inner Glow */}
      <path d={generateWavyPath(phase + 1.5)} fill="none" stroke={activeColor} strokeWidth={size * 0.005} className="opacity-10" style={{ transform: 'scale(0.96)', transformOrigin: 'center' }} />
    </svg>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const Pomodoro: React.FC<PomodoroProps> = ({ navigate }) => {
  const {
    timeLeft, overtime, isOvertime, running, mode, sessions, weekStats, todayIdx,
    focusDuration, breakDuration, setFocusDuration, setBreakDuration,
    start, pause, reset, startBreak, startNewSession, skipBreak, saveProgress, setWeekStats
  } = usePomodoro();

  const [view, setView] = React.useState<'week' | 'month' | 'year'>('week');
  const [phase, setPhase] = React.useState(0);
  const [showDurationEditor, setShowDurationEditor] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // ── Reset all focus time data from Firebase + localStorage ──
  const resetFocusData = useCallback(async () => {
    const zeroed = POMODORO_WEEKLY_MOCK.map(d => ({ ...d, sessions: 0, minutes: 0 }));
    await setWeekStats(zeroed);
  }, [setWeekStats]);

  useEffect(() => { document.title = 'Rakeeen - Pomodoro'; }, []);

  // Wave animation
  useEffect(() => {
    let animId: number;
    const animate = () => {
      setPhase(p => (p + 0.05) % (Math.PI * 2));
      animId = requestAnimationFrame(animate);
    };
    if (running || isOvertime) animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [running, isOvertime]);

  // ESC to exit fullscreen + Disable body scroll
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', handler);

    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = 'unset';
    };
  }, [isFullscreen]);

  const FOCUS_S = focusDuration * 60;
  const BREAK_S = breakDuration * 60;
  const pct = isOvertime ? 100 : (mode === 'focus'
    ? ((FOCUS_S - timeLeft) / FOCUS_S) * 100
    : ((BREAK_S - timeLeft) / BREAK_S) * 100
  );

  const activeColor = isOvertime ? 'text-rust' : (mode === 'focus' ? 'text-forest' : 'text-sepia');

  // Controls block (reused in both normal & fullscreen)
  const controls = (
    <div className="flex flex-col items-center gap-4">
      <div className="flex justify-center items-center gap-2">
        {isOvertime || (mode === 'break' && timeLeft === 0) ? (
          <Button variant="premium" onClick={isOvertime ? startBreak : startNewSession} className="min-w-[180px]">
            <HugeiconsIcon icon={mode === 'focus' ? RefreshIcon : PlayIcon} size={18} />
            <span className="ml-2 tracking-widest">{isOvertime ? 'Take a break' : 'Start new session'}</span>
          </Button>
        ) : (
          <>
            <Button onClick={running ? pause : start} variant="ghost" className="p-4 sm:p-5 text-forest border-ink/10">
              <HugeiconsIcon icon={running ? PauseIcon : PlayIcon} size={22} />
            </Button>
            <Button onClick={reset} variant="ghost" className="p-4 sm:p-5 text-ink/30 border-ink/10">
              <HugeiconsIcon icon={RefreshIcon} size={22} />
            </Button>
          </>
        )}

        {mode === 'focus' && running && !isOvertime && (
          <button
            onClick={saveProgress}
            className="text-[10px] uppercase font-black tracking-widest text-forest/40 hover:text-forest transition-all border-b border-forest/20 ml-2"
          >
            Done
          </button>
        )}
      </div>
      {mode === 'break' && (
        <button onClick={skipBreak} className="text-[10px] uppercase tracking-[0.2em] font-black text-ink/40 hover:text-sepia transition-all underline underline-offset-4">
          Skip Break
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* ── Fullscreen Overlay — Apple-level animation ───────────── */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(40px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)', transition: { duration: 0.3, ease: [0.32, 0, 0.67, 0] } }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[200] bg-[var(--bg)]/95 flex flex-col items-center justify-center"
            style={{ backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}
          >
            {/* Exit Button — fades in last */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setIsFullscreen(false)}
              className="absolute top-6 right-6 w-10 h-10 border border-ink/15 rounded-full flex items-center justify-center text-ink/30 hover:border-ink/40 hover:text-ink/60 transition-all"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
            </motion.button>

            {/* Mode Label — slides up */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className={`text-[10px] uppercase tracking-[0.5em] font-black mb-8 ${isOvertime ? 'text-rust' : activeColor}`}
            >
              {isOvertime ? 'Over-focusing' : (mode === 'focus' ? 'Focus' : 'Break')}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex items-center justify-center w-[320px] h-[320px] sm:w-[600px] sm:h-[600px]"
            >
              <div className={`absolute rounded-full blur-[100px] sm:blur-[160px] opacity-15 w-80 h-80 sm:w-[600px] sm:h-[600px] transition-colors duration-1000 ${isOvertime ? 'bg-rust' : (mode === 'focus' ? 'bg-forest' : 'bg-sepia')}`} />
              <WavyRing pct={pct} phase={phase} mode={mode} isOvertime={isOvertime} running={running} size={isFullscreen && typeof window !== 'undefined' && window.innerWidth < 640 ? 320 : 600} waves={mode === 'focus' ? focusDuration : breakDuration} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <motion.span
                  key={mode + String(isOvertime)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className={`text-5xl sm:text-[96px] leading-none font-black tracking-tight mb-2 transition-colors duration-500 tabular-nums ${isOvertime ? 'text-rust' : 'text-ink'}`}
                >
                  {isOvertime ? `+${formatTime(overtime)}` : formatTime(timeLeft)}
                </motion.span>
                <span className="text-[9px] sm:text-[10px] tracking-[0.5em] font-bold text-ink/30 uppercase">
                  {isOvertime ? 'Overtime' : mode}
                </span>
              </div>
            </motion.div>

            {/* Controls — slide up with delay */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="mt-12"
            >
              {controls}
            </motion.div>

            {/* Stats row — slide up last */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex gap-12 mt-10"
            >
              <div className="text-center">
                <div className="text-[9px] uppercase tracking-[0.3em] font-black text-ink/25 mb-1">Sessions</div>
                <div className="text-4xl font-black text-sepia tabular-nums">{sessions}</div>
              </div>
              <div className="w-px bg-ink/10" />
              <div className="text-center">
                <div className="text-[9px] uppercase tracking-[0.3em] font-black text-ink/25 mb-1">Focus time</div>
                <div className="text-4xl font-black text-sepia tabular-nums">{Math.round(weekStats?.[todayIdx]?.minutes || 0)}m</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Normal View ────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto py-6 sm:py-10 px-4 sm:px-5">
        <BackBtn onClick={() => navigate('home')} />

        <PageHeader
          title="Pomodoro"
          subtitle="Focus sessions & productivity analytics"
          size="md"
        />

        {/* Focus Session Card */}
        <div className="text-center mb-6 sm:mb-10 sys-card p-6 sm:p-8 relative">

          {/* Fullscreen Button */}
          <button
            onClick={() => setIsFullscreen(true)}
            className="absolute top-4 right-4 w-8 h-8 border-2 border-ink/20 rounded-[var(--radius-btn)] flex items-center justify-center text-ink/30 hover:border-ink/60 hover:text-ink/60 transition-all"
            title="Fullscreen"
          >
            <HugeiconsIcon icon={ArrowExpand01Icon} size={14} />
          </button>

          <div className={`text-[10px] uppercase tracking-[0.3em] font-black mb-8 ${isOvertime ? 'animate-pulse' : ''}`}>
            <span className={isOvertime ? 'text-rust' : (mode === 'focus' ? 'text-forest' : 'text-sepia')}>
              {isOvertime ? 'Over-focusing' : (mode === 'focus' ? 'Focus session' : 'Break time')}
            </span>
          </div>

          {/* Timer Circle */}
          <div className="relative w-full max-w-[300px] aspect-square mx-auto flex items-center justify-center">
            <div className={`absolute inset-4 sm:inset-10 rounded-full blur-[40px] sm:blur-[80px] opacity-20 -z-10 transition-colors duration-1000 ${isOvertime ? 'bg-rust' : (mode === 'focus' ? 'bg-forest' : 'bg-sepia')}`} />
            <WavyRing pct={pct} phase={phase} mode={mode} isOvertime={isOvertime} running={running} size={300} waves={mode === 'focus' ? focusDuration : breakDuration} />

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <motion.span
                className={`text-4xl sm:text-5xl font-black mb-1 transition-colors duration-500 ${isOvertime ? 'text-rust' : 'text-ink'}`}
                animate={{ scale: running ? [1, 1.02, 1] : 1 }}
                transition={{ repeat: Infinity, duration: 3 }}
              >
                {isOvertime ? `+${formatTime(overtime)}` : formatTime(timeLeft)}
              </motion.span>
              <span className="text-[10px] tracking-[0.3em] font-bold text-ink/40 uppercase">
                {isOvertime ? 'Overtime' : mode}
              </span>
            </div>
          </div>

          {/* Duration Editor trigger */}
          <div className="relative flex justify-center mt-4">
            <button
              onClick={() => setShowDurationEditor(v => !v)}
              className="text-[10px] uppercase tracking-[0.2em] font-black text-ink/30 hover:text-ink/60 transition-all border-b border-dashed border-ink/20 hover:border-ink/40 pb-0.5"
            >
              {focusDuration}m focus · {breakDuration}m break ✎
            </button>

            <AnimatePresence>
              {showDurationEditor && (
                <DurationEditor
                  focusDuration={focusDuration}
                  breakDuration={breakDuration}
                  onSave={(f, b) => {
                    setFocusDuration(f);
                    setBreakDuration(b);
                    setShowDurationEditor(false);
                  }}
                  onClose={() => setShowDurationEditor(false)}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="mt-8">{controls}</div>

          {/* Session Stats */}
          <div className="mt-10 flex justify-center gap-8">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-[0.2em] font-black text-ink/30 mb-1">Sessions</div>
              <div className="text-2xl font-black text-sepia">{sessions}</div>
            </div>
            <div className="w-px bg-ink/10" />
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-[0.2em] font-black text-ink/30 mb-1">Focus time</div>
              <div className="text-2xl font-black text-sepia">{Math.round(weekStats?.[todayIdx]?.minutes || 0)}m</div>
            </div>
          </div>
        </div>

        {/* Sessions Reports */}
        <div className="sys-card pb-4 p-6 sm:p-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-8">Sessions reports</h2>
          <Tabs
            tabs={['week', 'month', 'year']}
            activeTab={view}
            onChange={(v) => setView(v as any)}
            className="flex-wrap sm:justify-end mb-10 sm:-mt-16 gap-2"
          />

          <div className="h-[250px] w-full mt-4">
            <ResponsiveContainer>
              <BarChart data={view === 'week' ? weekStats : POMODORO_MONTHLY_MOCK} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(232,224,208,0.05)" />
                <XAxis dataKey={view === 'week' ? 'day' : 'week'} tick={{ fill: 'var(--ink)', opacity: 0.4, fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fill: 'var(--ink)', opacity: 0.4, fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(124,169,130,0.05)' }}
                  content={<ChartTooltip unit="Sessions" getTipMessage={(val) => getTip(val, view)} />}
                />

                {/* Goal Reference Line (Matches Hydration) */}
                <ReferenceLine
                  y={view === 'week' ? 8 : view === 'month' ? 40 : 1000}
                  stroke="var(--forest)"
                  strokeDasharray="5 5"
                  strokeOpacity={0.4}
                />

                <Bar dataKey="sessions" radius={[0, 0, 0, 0]} maxBarSize={40}>
                  {(view === 'week' ? weekStats : POMODORO_MONTHLY_MOCK).map((_: any, i: number) => (
                    <Cell key={i} fill="var(--forest)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
};
