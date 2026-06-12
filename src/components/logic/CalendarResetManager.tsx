import React, { useEffect } from 'react';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { POMODORO_WEEKLY_MOCK } from '../../constants/mockData';

const ICAL_URL = 'https://calendar.google.com/calendar/ical/9ce9f7279f0afeef711ae5c21eb29f4f087e8cb74aef36a9bbd0d58751e61587%40group.calendar.google.com/private-8496d29b04f57f4c8452f99dd5dbe203/basic.ics';

export const CalendarResetManager: React.FC = () => {
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

      // 1. Water History
      if (glasses > 0) {
        const newHistory = { ...history, [lastDateStr]: glasses };
        setHistory(newHistory);
      }
      setGlasses(0);
      setLog([]);
      
      // 2. Fitness History
      const totalCalories = Object.values(meals).flat().reduce((sum, item) => sum + (item.kcal || 0), 0);
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

      if (lastPomoResetDate !== resetMarker) {
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

    const checkCalendar = async () => {
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

        // If no sleep events are found in the calendar, default to 5:00 AM to 11:00 AM sleep time (reset at 2:00 AM)
        if (parsedEvents.length === 0) {
          const fallbackSleepToday = new Date(today);
          fallbackSleepToday.setHours(5, 0, 0, 0); // 5:00 AM today

          const fallbackSleepYesterday = new Date(today);
          fallbackSleepYesterday.setDate(fallbackSleepYesterday.getDate() - 1);
          fallbackSleepYesterday.setHours(5, 0, 0, 0); // 5:00 AM yesterday

          const fallbackSleepTomorrow = new Date(today);
          fallbackSleepTomorrow.setDate(fallbackSleepTomorrow.getDate() + 1);
          fallbackSleepTomorrow.setHours(5, 0, 0, 0); // 5:00 AM tomorrow

          parsedEvents.push({ start: fallbackSleepYesterday, summary: 'Fallback Sleep' });
          parsedEvents.push({ start: fallbackSleepToday, summary: 'Fallback Sleep' });
          parsedEvents.push({ start: fallbackSleepTomorrow, summary: 'Fallback Sleep' });
        }

        // Sort events by start time
        parsedEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

        // Find and cache the next upcoming sleep event
        const upcomingEvent = parsedEvents.find(e => {
          const resetTime = new Date(e.start.getTime() - 3 * 60 * 60 * 1000);
          return resetTime > now;
        });
        if (upcomingEvent) {
          localStorage.setItem('system_next_sleep_time', upcomingEvent.start.toISOString());
        }

        // Find the most relevant sleep event that HAS ALREADY PASSED its reset time
        let targetEvent = null;
        for (let i = parsedEvents.length - 1; i >= 0; i--) {
          const resetTime = new Date(parsedEvents[i].start.getTime() - 3 * 60 * 60 * 1000);
          if (now >= resetTime) {
            targetEvent = parsedEvents[i];
            break;
          }
        }

        if (targetEvent) {
          const resetTime = new Date(targetEvent.start.getTime() - 3 * 60 * 60 * 1000);
          // Use the date of the reset time itself as the unique marker
          const resetMarker = resetTime.toDateString(); 

          if (lastResetDate !== resetMarker) {
            console.log(`[CalendarResetManager] Triggering reset for sleep at ${targetEvent.start.toLocaleString()} (Reset was due at ${resetTime.toLocaleString()})`);
            await performReset(targetEvent.start);
            setLastResetDate(resetMarker);
          }
        } else {
          console.log(`[CalendarResetManager] Waiting for upcoming sleep event reset time...`);
        }

      } catch (e) {
        console.error('CalendarResetManager error:', e);
      }
    };

    const runChecks = () => {
      checkCalendar();
      checkPomoReset();
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
