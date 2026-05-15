import React, { useEffect } from 'react';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';

const ICAL_URL = 'https://calendar.google.com/calendar/ical/9ce9f7279f0afeef711ae5c21eb29f4f087e8cb74aef36a9bbd0d58751e61587%40group.calendar.google.com/private-8496d29b04f57f4c8452f99dd5dbe203/basic.ics';

export const CalendarResetManager: React.FC = () => {
  // Sync states for resetting
  const [glasses, setGlasses] = useFirebaseSync<number>('hydration_glasses', 0);
  const [, setLog] = useFirebaseSync<any[]>('hydration_log', []);
  const [history, setHistory] = useFirebaseSync<Record<string, number>>('hydration_history', {});
  
  const [meals, setMeals] = useFirebaseSync<Record<string, any[]>>('fitness_meals', { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] });
  const [fitHistory, setFitHistory] = useFirebaseSync<Record<string, number>>('fitness_history', {});
  
  const [, setPomoSessions] = useFirebaseSync<number>('pomodoro_sessions', 0);
  const [pomoWeek, setPomoWeek] = useFirebaseSync<any[]>('pomodoro_week', []);
  const [pomoHistory, setPomoHistory] = useFirebaseSync<Record<string, { sessions: number, minutes: number }>>('pomodoro_history', {});

  const [lastResetDate, setLastResetDate] = useFirebaseSync<string>('system_last_reset_date', '');

  useEffect(() => {
    const performReset = async (sleepDate: Date) => {
      const now = new Date();
      const todayStr = now.toDateString();
      const lastDateStr = new Date(sleepDate.getTime() - 12 * 60 * 60 * 1000).toDateString(); // Yesterday relative to sleep

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

      // 3. Pomodoro History
      const todayIdx = (new Date(lastDateStr).getDay() + 6) % 7; // Mon-Sun
      const todayPomo = pomoWeek[todayIdx] || { sessions: 0, minutes: 0 };
      if (todayPomo.sessions > 0) {
        const newPomoHistory = { ...pomoHistory, [lastDateStr]: { sessions: todayPomo.sessions, minutes: todayPomo.minutes } };
        setPomoHistory(newPomoHistory);
      }
      setPomoSessions(0);
      // Reset only today's slot in pomoWeek or reset whole week if it's Monday?
      // User said "every week the analysis starts from the beginning".
      // Let's reset the whole week if today is Monday.
      // Reset whole week if it's Saturday
      if (new Date().getDay() === 6) { // Saturday
        setPomoWeek(pomoWeek.map(d => ({ ...d, sessions: 0, minutes: 0 })));
      }

      // Update the marker
      setLastResetDate(todayStr);
    };

    const checkCalendar = async () => {
      try {
        const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(ICAL_URL)}`);
        if (!res.ok) throw new Error('Failed to fetch calendar');
        const text = await res.text();
        const unfoldedText = text.replace(/\r?\n[ \t]/g, '');
        const lines = unfoldedText.split(/\r?\n/);
        
        const events: { start: Date; summary: string }[] = [];
        let curr: any = {};

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

        for (let line of lines) {
          if (line.startsWith('BEGIN:VEVENT')) curr = {};
          else if (line.startsWith('END:VEVENT')) {
            const isSleep = curr.summary?.toLowerCase().includes('sleep') || curr.summary?.toLowerCase().includes('أسليب');
            if (isSleep && curr.dtstart) {
              const start = parseDate(curr.dtstart);
              if (start) events.push({ start, summary: curr.summary });
            }
          }
          else if (line.startsWith('SUMMARY:')) curr.summary = line.substring(8);
          else if (line.startsWith('DTSTART')) curr.dtstart = line.split(':')[1] || line.split(';')[1]?.split(':')[1];
        }

        const now = new Date();

        // Sort events by start time
        events.sort((a, b) => a.start.getTime() - b.start.getTime());

        // Find the most relevant sleep event (either the one we are currently in or the next one)
        // We want to find the sleep event whose reset time (start - 3h) is the most recent one that has passed.
        let targetEvent = null;
        for (let i = events.length - 1; i >= 0; i--) {
          const resetTime = new Date(events[i].start.getTime() - 3 * 60 * 60 * 1000);
          if (now >= resetTime) {
            targetEvent = events[i];
            break;
          }
        }

        if (targetEvent) {
          const resetTime = new Date(targetEvent.start.getTime() - 3 * 60 * 60 * 1000);
          // If we haven't reset for THIS specific sleep's cycle yet
          // We use the resetTime's date as the unique marker
          const resetMarker = resetTime.toDateString(); 

          if (lastResetDate !== resetMarker) {
            console.log(`[CalendarResetManager] Triggering reset for sleep at ${targetEvent.start.toLocaleString()} (Reset was due at ${resetTime.toLocaleString()})`);
            performReset(targetEvent.start);
            setLastResetDate(resetMarker);
          }
        } else {
          console.log(`[CalendarResetManager] Waiting for upcoming sleep event reset time...`);
        }

      } catch (e) {
        console.error('CalendarResetManager error:', e);
      }
    };

    const interval = setInterval(checkCalendar, 2 * 60 * 1000); // Check every 2 minutes for precision
    checkCalendar();
    return () => clearInterval(interval);
  }, [lastResetDate, glasses, history, meals, fitHistory, setGlasses, setLog, setHistory, setMeals, setFitHistory, setLastResetDate, setPomoSessions, setPomoWeek, setPomoHistory, pomoWeek, pomoHistory]);

  return null;
};
