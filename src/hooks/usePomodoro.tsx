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
    if (Notification.permission === 'default') {
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
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.png' });
    }
  }, []);

  const sendDiscordNotification = useCallback(async (type: 'focus_complete' | 'break_complete', overtimeSecs = 0) => {
    const webhookUrl = import.meta.env.VITE_DISCORD_POMODORO_WEBHOOK;
    if (!webhookUrl) return;
    const overtimeStr = overtimeSecs > 0 ? ` (+${Math.floor(overtimeSecs/60)}m ${overtimeSecs%60}s overtime)` : '';
    const embed = type === 'focus_complete' ? {
      title: '🧠 Focus Session Complete',
      description: `Great work! You've finished a **${focusDuration}-minute** focus session${overtimeStr}.\nTime to take a break.`,
      color: 0x7ca982,
      footer: { text: 'Rakeeen Pomodoro System' }
    } : {
      title: '☕ Break Time Over',
      description: `Your **${breakDuration}-minute** break is done. Ready for another round?`,
      color: 0xc8a96e,
      footer: { text: 'Rakeeen Pomodoro System' }
    };
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      });
    } catch (e) { /* silent */ }
  }, [focusDuration, breakDuration]);

  // Core timer logic
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        if (isOvertime) {
          setOvertime(o => o + 1);
        } else {
          setTimeLeft(t => {
            if (t <= 1) {
              if (mode === 'focus') {
                setIsOvertime(true);
                sendNotification("Focus session complete", `You've finished ${focusDuration} minutes. Take a break or keep going.`);
                sendDiscordNotification('focus_complete', 0);
                return 0;
              } else {
                setRunning(false);
                setMode('focus');
                sendNotification("Break finished", "Time to start a new focus session.");
                sendDiscordNotification('break_complete');
                return FOCUS;
              }
            }
            return t - 1;
          });
        }
      }, 1000);
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
    
    const updated = weekStats.map((d: any, i: number) => 
      i === todayIdx ? { ...d, sessions: d.sessions + 1, minutes: (d.minutes || 0) + focusGained } : d
    );
    setWeekStats(updated);

    setMode('break');
    setIsOvertime(false);
    setOvertime(0);
    setTimeLeft(BREAK);
    setRunning(true);
  }, [overtime, weekStats, todayIdx, setWeekStats, BREAK, focusDuration]);

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
