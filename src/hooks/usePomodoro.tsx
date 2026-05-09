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
}

const PomodoroContext = createContext<PomodoroContextType | null>(null);

export const PomodoroProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [focusDuration, setFocusDurationState] = useState(25); // minutes
  const [breakDuration, setBreakDurationState] = useState(5);  // minutes
  const FOCUS = focusDuration * 60;
  const BREAK = breakDuration * 60;
  const [timeLeft, setTimeLeft] = useState(FOCUS);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [overtime, setOvertime] = useState(0);
  const [isOvertime, setIsOvertime] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [lastDate, setLastDate] = useState(new Date().toDateString());
  const [weekStats, setWeekStats] = useFirebaseSync('pomodoro_week', POMODORO_WEEKLY_MOCK);
  const todayIdx = getTodayIdx();
  const timerRef = useRef<any>(null);

  const setFocusDuration = useCallback((m: number) => {
    setFocusDurationState(m);
    setTimeLeft(m * 60);
    setRunning(false);
    setIsOvertime(false);
    setOvertime(0);
    setMode('focus');
  }, []);

  const setBreakDuration = useCallback((m: number) => {
    setBreakDurationState(m);
  }, []);

  // Request Notification permission
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Daily Reset
  useEffect(() => {
    const today = new Date().toDateString();
    if (today !== lastDate) {
      setSessions(0);
      setLastDate(today);
    }
  }, [lastDate]);

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

  const sendNotification = useCallback((title: string, body: string) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.png' });
    }
  }, []);

  const sendDiscordNotification = useCallback(async (type: 'focus_started' | 'focus_complete' | 'break_complete' | 'test', data?: { duration?: number, overtime?: number }) => {
    const webhookUrl = import.meta.env.VITE_DISCORD_POMODORO_WEBHOOK;
    if (!webhookUrl) return;

    const embeds: any[] = [];
    
    if (type === 'focus_complete') {
      const totalMins = (data?.duration || focusDuration) + Math.floor((data?.overtime || 0) / 60);
      embeds.push({
        title: '🧠 Focus Session Finished',
        description: `Excellent! You've completed **${totalMins} minutes** of deep work.`,
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
        description: `Your **${breakDuration}-minute** break is done. Time to return to flow state.`,
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
              sendNotification("Focus session complete", `You've finished ${focusDuration} minutes. Take a break or keep going.`);
              // We only send a "Time's up" browser notification at 0, 
              // but we'll send the final Discord report when they actually click "Start Break"
              // to capture the full time spent.
            } else {
              // Break finished
              setRunning(false);
              setMode('focus');
              setTimeLeft(FOCUS);
              sendNotification("Break finished", "Time to start a new focus session.");
              sendDiscordNotification('break_complete');
            }
          }
        }
      }, 200);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, mode, isOvertime, sendNotification, sendDiscordNotification, FOCUS, focusDuration]);

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
    setSessions(s => s + 1);
    
    // Send Discord Report with full time (Base + Overtime)
    sendDiscordNotification('focus_complete', { duration: focusDuration, overtime });

    const updated = weekStats.map((d: any, i: number) => 
      i === todayIdx ? { ...d, sessions: d.sessions + 1, minutes: (d.minutes || 0) + focusGained } : d
    );
    setWeekStats(updated);

    setMode('break');
    setIsOvertime(false);
    setOvertime(0);
    setTimeLeft(BREAK);
    setRunning(true);
  }, [overtime, weekStats, todayIdx, setWeekStats, BREAK, focusDuration, sendDiscordNotification]);

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

  return (
    <PomodoroContext.Provider value={{
      timeLeft, overtime, isOvertime, running, mode, sessions, weekStats, todayIdx,
      focusDuration, breakDuration, setFocusDuration, setBreakDuration,
      setWeekStats,
      start, pause, reset, startBreak, startNewSession, skipBreak
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
