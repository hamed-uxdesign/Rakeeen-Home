import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useFirebaseSync } from './useFirebaseSync';
import { POMODORO_WEEKLY_MOCK } from '../constants/mockData';
import { getTodayIdx } from '../utils/timeHelpers';

interface PomodoroContextType {
  timeLeft: number;
  overtime: number;
  isOvertime: boolean;
  running: boolean;
  mode: 'focus' | 'break';
  sessions: number;
  weekStats: any[];
  logs: any[];
  history: Record<string, { sessions: number, minutes: number, logs?: any[] }>;
  todayIdx: number;
  focusDuration: number;
  breakDuration: number;
  setFocusDuration: (m: number) => void;
  setBreakDuration: (m: number) => void;
  setWeekStats: (v: any) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  startBreak: () => void;
  startNewSession: () => void;
  skipBreak: () => void;
  saveProgress: () => void;
}

const PomodoroContext = createContext<PomodoroContextType | null>(null);

export const PomodoroProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [focusDuration] = useState(25); // minutes (enforced 25m default)
  const [breakDuration, setBreakDurationState] = useState(5);  // minutes (initially 5m)
  const FOCUS = focusDuration * 60;
  const [timeLeft, setTimeLeft] = useState(FOCUS);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [overtime, setOvertime] = useState(0);
  const [isOvertime, setIsOvertime] = useState(false);
  const [sessions, setSessions] = useFirebaseSync<number>('pomodoro_sessions', 0);
  const [rawWeekStats, setWeekStats] = useFirebaseSync<any[]>('pomodoro_week', POMODORO_WEEKLY_MOCK);
  const weekStats = Array.isArray(rawWeekStats) && rawWeekStats.length === 7 ? rawWeekStats : POMODORO_WEEKLY_MOCK;
  const [logs, setLogs] = useFirebaseSync<any[]>('pomodoro_logs', []);
  const [history] = useFirebaseSync<Record<string, { sessions: number, minutes: number, logs?: any[] }>>('pomodoro_history', {});
  const todayIdx = getTodayIdx();
  const timerRef = useRef<any>(null);

  const setFocusDuration = useCallback((m: number) => {
    // Hardcoded default 25 minutes, ignoring changes
  }, []);

  const setBreakDuration = useCallback((m: number) => {
    // Dynamic calculations done automatically, ignoring manual set
  }, []);



  // Daily Reset handled by CalendarResetManager

  // Warn before leaving site while timer is running
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (running || isOvertime) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [running, isOvertime]);



  const sendDiscordNotification = useCallback(async (type: 'focus_started' | 'focus_timer_up' | 'focus_complete' | 'break_complete' | 'test', data?: { duration?: number, overtime?: number }) => {
    // @ts-ignore
    const webhookUrl = import.meta.env.VITE_DISCORD_POMODORO_WEBHOOK;
    if (!webhookUrl) return;

    const embeds: any[] = [];
    
    if (type === 'focus_timer_up') {
      embeds.push({
        title: '🔔 Focus Session Finished!',
        description: `You finished **${focusDuration} minutes**, take a break.`,
        color: 0x7ca982,
        footer: { text: 'Rakeeen Productivity System' },
        timestamp: new Date().toISOString()
      });
    } else if (type === 'focus_complete') {
      const totalMins = (data?.duration || focusDuration) + Math.floor((data?.overtime || 0) / 60);
      embeds.push({
        title: '🧠 Focus Session Logged',
        description: `Excellent! You've logged **${totalMins} minutes** of deep work.`,
        fields: [
          { name: 'Base Goal', value: `${data?.duration || focusDuration}m`, inline: true },
          { name: 'Overtime', value: `${Math.floor((data?.overtime || 0) / 60)}m ${ (data?.overtime || 0) % 60}s`, inline: true }
        ],
        color: 0x7ca982,
        footer: { text: 'Rakeeen Productivity System' },
        timestamp: new Date().toISOString()
      });
    } else if (type === 'break_complete') {
      embeds.push({
        title: '☕ Break Time Over',
        description: `Your break is done? Time to get back to work! 🚀`,
        color: 0xc8a96e,
        footer: { text: 'Rakeeen Productivity System' },
        timestamp: new Date().toISOString()
      });
    }

    if (embeds.length === 0) return;

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds })
      });
    } catch (e) { console.error('Discord Webhook Error:', e); }
  }, [focusDuration, breakDuration]);

  // Core timer logic - Robust against background throttling
  const startTimeRef = useRef<number | null>(null);
  const baseTimeLeftRef = useRef<number>(timeLeft);
  const baseOvertimeRef = useRef<number>(overtime);

  useEffect(() => {
    if (running) {
      startTimeRef.current = Date.now();
      baseTimeLeftRef.current = timeLeft;
      baseOvertimeRef.current = overtime;

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
        
        if (isOvertime) {
          setOvertime(baseOvertimeRef.current + elapsed);
        } else {
          const newTime = Math.max(0, baseTimeLeftRef.current - elapsed);
          setTimeLeft(newTime);

          if (newTime <= 0) {
            if (mode === 'focus') {
              setIsOvertime(true);
              sendDiscordNotification('focus_timer_up');
              // We only send a "Time's up" browser notification at 0, 
              // but we'll send the final Discord report when they actually click "Start Break"
              // to capture the full time spent.
            } else {
              // Break finished
              setRunning(false);
              setMode('focus');
              setTimeLeft(FOCUS);
              sendDiscordNotification('break_complete');
            }
          }
        }
      }, 200);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, mode, isOvertime, sendDiscordNotification, FOCUS, focusDuration]);

  const start = useCallback(() => setRunning(true), []);
  const pause = useCallback(() => setRunning(false), []);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
    setIsOvertime(false);
    setOvertime(0);
    setMode('focus');
    setTimeLeft(FOCUS);
  }, [FOCUS]);

  const startBreak = useCallback(() => {
    const focusGained = focusDuration + Math.floor(overtime / 60);
    
    // Dynamic break calculation: exactly 20% of total focus session duration (focusDuration + overtime)
    // 25 minutes => 5 minutes break
    // 50 minutes => 10 minutes break
    const calculatedBreakMins = Math.max(1, Math.round(focusGained * 0.2));
    setBreakDurationState(calculatedBreakMins);

    setSessions(s => s + 1);
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    setLogs(l => [{ time: nowTime, duration: focusGained }, ...l]);
    
    // Send Discord Report with full time (Base + Overtime)
    sendDiscordNotification('focus_complete', { duration: focusDuration, overtime });

    const currentWeekStats = Array.isArray(weekStats) && weekStats.length === 7 ? weekStats : POMODORO_WEEKLY_MOCK;
    const updated = currentWeekStats.map((d: any, i: number) => 
      i === todayIdx ? { ...d, sessions: d.sessions + 1, minutes: (d.minutes || 0) + focusGained } : d
    );
    setWeekStats(updated);

    setMode('break');
    setIsOvertime(false);
    setOvertime(0);
    setTimeLeft(calculatedBreakMins * 60);
    setRunning(true);
  }, [overtime, weekStats, todayIdx, setWeekStats, focusDuration, sendDiscordNotification]);

  const startNewSession = useCallback(() => {
    setMode('focus');
    setIsOvertime(false);
    setOvertime(0);
    setTimeLeft(FOCUS);
    setRunning(true);
  }, [FOCUS]);

  const skipBreak = useCallback(() => {
    setMode('focus');
    setIsOvertime(false);
    setOvertime(0);
    setTimeLeft(FOCUS);
    setRunning(false);
  }, [FOCUS]);

  const saveProgress = useCallback(() => {
    if (mode !== 'focus') return;
    
    const focusGained = Math.max(1, Math.floor((focusDuration * 60 - timeLeft + overtime) / 60));
    
    // Dynamic break calculation: exactly 20% of total focus session duration (focusDuration + overtime)
    const calculatedBreakMins = Math.max(1, Math.round(focusGained * 0.2));
    setBreakDurationState(calculatedBreakMins);

    setSessions(s => s + 1);
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    setLogs(l => [{ time: nowTime, duration: focusGained }, ...l]);
    
    // Send Discord Report with full time (Base + Overtime)
    sendDiscordNotification('focus_complete', { duration: focusDuration, overtime });

    const currentWeekStats = Array.isArray(weekStats) && weekStats.length === 7 ? weekStats : POMODORO_WEEKLY_MOCK;
    const updated = currentWeekStats.map((d: any, i: number) => 
      i === todayIdx ? { ...d, sessions: d.sessions + 1, minutes: (d.minutes || 0) + focusGained } : d
    );
    setWeekStats(updated);

    setMode('break');
    setIsOvertime(false);
    setOvertime(0);
    setTimeLeft(calculatedBreakMins * 60);
    setRunning(true);
  }, [mode, focusDuration, timeLeft, overtime, weekStats, todayIdx, setWeekStats, sendDiscordNotification, setLogs]);

  return (
    <PomodoroContext.Provider value={{
      timeLeft, overtime, isOvertime, running, mode, sessions, weekStats, history, todayIdx,
      focusDuration, breakDuration, setFocusDuration, setBreakDuration,
      setWeekStats, logs,
      start, pause, reset, startBreak, startNewSession, skipBreak, saveProgress
    }}>
      {children}
    </PomodoroContext.Provider>
  );
};

export const usePomodoro = () => {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error('usePomodoro must be used within PomodoroProvider');
  return ctx;
};
