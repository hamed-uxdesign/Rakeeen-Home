import React, { useEffect, useRef } from 'react';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { POMODORO_WEEKLY_MOCK } from '../../constants/mockData';

const ICAL_URL = 'https://calendar.google.com/calendar/ical/hamed.rakeeen%40gmail.com/private-aa7a61a1272c8a39e1d8c9e1d8ecba50/basic.ics';

export const CalendarResetManager: React.FC = () => {
  // Guards against double-firing when Firebase hasn't confirmed lastResetDate yet
  const firedResetMarkerRef = useRef<string>('');
  const firedPomoMarkerRef  = useRef<string>('');

  // Sync states for resetting
  const [glasses, setGlasses, glassesReady] = useFirebaseSync<number>('hydration_glasses', 0);
  const [, setLog, logReady] = useFirebaseSync<any[]>('hydration_log', []);
  const [history, setHistory, historyReady] = useFirebaseSync<Record<string, number>>('hydration_history', {});
  
  const [meals, setMeals, mealsReady] = useFirebaseSync<Record<string, any[]>>('fitness_meals', { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] });
  const [fitHistory, setFitHistory, fitHistoryReady] = useFirebaseSync<Record<string, number>>('fitness_history', {});
  
  const [, setPomoSessions, pomoReady] = useFirebaseSync<number>('pomodoro_sessions', 0);
  const [pomoWeek, setPomoWeek, pomoWeekReady] = useFirebaseSync<any[]>('pomodoro_week', POMODORO_WEEKLY_MOCK);
  const [pomoHistory, setPomoHistory, pomoHistoryReady] = useFirebaseSync<Record<string, { sessions: number, minutes: number }>>('pomodoro_history', {});

  const [lastResetDate, setLastResetDate, lastResetDateReady] = useFirebaseSync<string>('system_last_reset_date', '');
  const [lastPomoResetDate, setLastPomoResetDate, lastPomoResetDateReady] = useFirebaseSync<string>('system_last_pomo_reset_date', '');

  useEffect(() => {
    // Wait until ALL Firebase sync hooks are ready before we check the calendar and potentially run reset
    if (
      !glassesReady ||
      !logReady ||
      !historyReady ||
      !mealsReady ||
      !fitHistoryReady ||
      !pomoReady ||
      !pomoWeekReady ||
      !pomoHistoryReady ||
      !lastResetDateReady ||
      !lastPomoResetDateReady
    ) {
      console.log('[CalendarResetManager] Waiting for Firebase sync to be ready...');
      return;
    }

    const performReset = async (sleepDate: Date) => {
      // We calculate the logical "yesterday" relative to the sleep date
      const lastDateStr = new Date(sleepDate.getTime() - 12 * 60 * 60 * 1000).toDateString();

      console.log(`[CalendarResetManager] Recording history and resetting for: ${lastDateStr}`);

      // Read the freshest values straight from localStorage instead of the closure's
      // `glasses`/`meals` state, which can lag behind what Water.tsx/Fitness just wrote
      // (React state updates from a Firestore listener aren't guaranteed to have flushed
      // into this closure yet), causing the archived tally to be recorded as 0.
      const currentGlasses = (() => {
        try { return Number(JSON.parse(window.localStorage.getItem('hydration_glasses') || '0')) || 0; }
        catch { return glasses; }
      })();
      const currentMeals = (() => {
        try { return JSON.parse(window.localStorage.getItem('fitness_meals') || 'null') ?? meals; }
        catch { return meals; }
      })();

      // 1. Water History
      if (currentGlasses > 0) {
        const newHistory = { ...history, [lastDateStr]: currentGlasses };
        setHistory(newHistory);
      }
      setGlasses(0);
      setLog([]);

      // 2. Fitness History
      const totalCalories = Object.values(currentMeals).flat().reduce((sum: number, item: any) => sum + (item.kcal || 0), 0);
      if (totalCalories > 0) {
        const newFitHistory = { ...fitHistory, [lastDateStr]: totalCalories };
        setFitHistory(newFitHistory);
      }
      setMeals({ Breakfast: [], Lunch: [], Dinner: [], Snacks: [] });
    };

    const checkPomoReset = () => {
      const now = new Date();
      // Pomodoro resets at 4:00 AM.
      // So the logical yesterday for Pomodoro is "now - 4 hours" to see what day it is,
      // and we check if we've already done the reset for that logical yesterday.
      const pomoLogicalToday = new Date(now.getTime() - 4 * 60 * 60 * 1000);
      const pomoLogicalYesterdayDate = new Date(pomoLogicalToday.getTime() - 24 * 60 * 60 * 1000);
      const resetMarker = pomoLogicalYesterdayDate.toDateString(); // The day we need to reset/save to history

      if (lastPomoResetDate !== resetMarker && firedPomoMarkerRef.current !== resetMarker) {
        firedPomoMarkerRef.current = resetMarker;
        window.localStorage.setItem('system_last_pomo_reset_date', JSON.stringify(resetMarker));
        window.localStorage.setItem('system_last_pomo_reset_date_updatedAt', new Date().toISOString());
        console.log(`[CalendarResetManager] Triggering Pomodoro reset for logical day: ${resetMarker}`);
        
        // Save to history
        const yesterdayIdx = (pomoLogicalYesterdayDate.getDay() + 6) % 7; // Mon-Sun
        const currentPomoWeek = Array.isArray(pomoWeek) && pomoWeek.length === 7 ? pomoWeek : POMODORO_WEEKLY_MOCK;
        const yesterdayPomo = currentPomoWeek[yesterdayIdx] || { sessions: 0, minutes: 0 };
        
        if (yesterdayPomo.sessions > 0) {
          const newPomoHistory = { ...pomoHistory, [resetMarker]: { sessions: yesterdayPomo.sessions, minutes: yesterdayPomo.minutes } };
          setPomoHistory(newPomoHistory);
        }
        
        setPomoSessions(0);
        
        // Reset the week stats if the day that just ended was Friday (idx 4) and now we are starting Saturday (idx 5)
        const currentLogicalDayIdx = (pomoLogicalToday.getDay() + 6) % 7; // Monday = 0, Saturday = 5, Sunday = 6
        if (currentLogicalDayIdx === 5) {
          setPomoWeek(POMODORO_WEEKLY_MOCK); // Reset all Mon-Sun to 0
        } else {
          // Just clear the new logical day's stats in case they had leftover data from the previous week:
          const updatedWeek = currentPomoWeek.map((d: any, i: number) => 
            i === currentLogicalDayIdx ? { ...d, sessions: 0, minutes: 0 } : d
          );
          setPomoWeek(updatedWeek);
        }

        setLastPomoResetDate(resetMarker);
      }
    };

    // Fixed schedule: sleep at 21:00 → reset trigger is 3h earlier, at 18:00.
    // Computed purely from the wall clock — no network fetch in the critical path,
    // so a page refresh can never race an in-flight calendar request.
    const SLEEP_HOUR = 21;
    const RESET_HOUR = SLEEP_HOUR - 3; // 18:00

    const checkReset = () => {
      const now = new Date();
      // "Today's logical day" ends at RESET_HOUR. Before that time we're still
      // finishing yesterday's logical day; at/after it we've crossed into today's.
      const resetDateBase = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (now.getHours() < RESET_HOUR) {
        resetDateBase.setDate(resetDateBase.getDate() - 1);
      }
      const resetMarker = resetDateBase.toDateString();

      if (lastResetDate !== resetMarker && firedResetMarkerRef.current !== resetMarker) {
        firedResetMarkerRef.current = resetMarker;
        // Write value + updatedAt synchronously (mirrors useFirebaseSync's setValue) so a
        // refresh mid-reset sees the marker AND the Firestore listener won't clobber it
        // back with the stale server value once it connects.
        const nowIso = new Date().toISOString();
        window.localStorage.setItem('system_last_reset_date', JSON.stringify(resetMarker));
        window.localStorage.setItem('system_last_reset_date_updatedAt', nowIso);
        console.log(`[CalendarResetManager] Triggering reset for logical day: ${resetMarker}`);
        const sleepMoment = new Date(resetDateBase);
        sleepMoment.setHours(SLEEP_HOUR, 0, 0, 0);
        performReset(sleepMoment);
        setLastResetDate(resetMarker);
      }
    };

    // Best-effort calendar fetch — purely informational (used only to cache the next
    // sleep time), never gates the reset decision above.
    const fetchNextSleepTime = async () => {
      try {
        const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(ICAL_URL)}`);
        if (!res.ok) throw new Error('Failed to fetch calendar');
        const text = await res.text();
        const unfoldedText = text.replace(/\r?\n[ \t]/g, '');
        const lines = unfoldedText.split(/\r?\n/);

        let curr: any = { rrule: '' };
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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

        const parsedEvents: { start: Date, summary: string }[] = [];

        for (let line of lines) {
          if (line.startsWith('BEGIN:VEVENT')) {
            curr = { rrule: '' };
          } else if (line.startsWith('END:VEVENT')) {
            const isSleep = curr.summary?.toLowerCase().includes('sleep') || curr.summary?.toLowerCase().includes('أسليب');
            if (isSleep && curr.dtstart) {
              const baseStart = parseDate(curr.dtstart);
              if (baseStart) {
                let untilDate = null;
                if (curr.rrule.includes('UNTIL=')) {
                  const match = curr.rrule.match(/UNTIL=([0-9T]+Z?)/);
                  if (match) untilDate = parseDate(match[1]);
                }

                const addIfMatches = (offsetDays: number) => {
                  if (untilDate && untilDate.getTime() < today.getTime()) return;
                  const instStart = new Date(baseStart.getTime());
                  const targetDate = new Date(today);
                  targetDate.setDate(targetDate.getDate() + offsetDays);
                  instStart.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
                  parsedEvents.push({ start: instStart, summary: curr.summary });
                };

                if (curr.rrule.includes('FREQ=DAILY')) {
                  addIfMatches(-1); // Yesterday's occurrence
                  addIfMatches(0);  // Today's occurrence
                  addIfMatches(1);  // Tomorrow's occurrence
                } else {
                  parsedEvents.push({ start: baseStart, summary: curr.summary });
                }
              }
            }
            curr = { rrule: '' };
          } else if (line.startsWith('SUMMARY:')) curr.summary = line.substring(8);
          else if (line.startsWith('DTSTART')) curr.dtstart = line.split(':')[1] || line.split(';')[1]?.split(':')[1];
          else if (line.startsWith('RRULE:')) curr.rrule = line;
        }

        parsedEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

        const upcomingEvent = parsedEvents.find(e => e.start > now);
        if (upcomingEvent) {
          localStorage.setItem('system_next_sleep_time', upcomingEvent.start.toISOString());
        }
      } catch (e) {
        console.error('CalendarResetManager fetch error:', e);
      }
    };

    const runChecks = () => {
      checkReset();
      checkPomoReset();
      fetchNextSleepTime();
    };

    const interval = setInterval(runChecks, 2 * 60 * 1000); // Check every 2 minutes
    runChecks();
    return () => clearInterval(interval);
  }, [
    lastResetDate, lastPomoResetDate, glasses, history, meals, fitHistory, setGlasses, setLog, setHistory, setMeals, setFitHistory, setLastResetDate, setLastPomoResetDate, setPomoSessions, setPomoWeek, setPomoHistory, pomoWeek, pomoHistory,
    glassesReady, logReady, historyReady, mealsReady, fitHistoryReady, pomoReady, pomoWeekReady, pomoHistoryReady, lastResetDateReady, lastPomoResetDateReady
  ]);

  return null;
};
