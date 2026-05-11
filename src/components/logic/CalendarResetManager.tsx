import React, { useEffect } from 'react';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';

const ICAL_URL = 'https://calendar.google.com/calendar/ical/hamed.rakeeen%40gmail.com/private-aa7a61a1272c8a39e1d8c9e1d8ecba50/basic.ics';

export const CalendarResetManager: React.FC = () => {
  // Sync states for resetting
  const [glasses, setGlasses] = useFirebaseSync<number>('hydration_glasses', 0);
  const [, setLog] = useFirebaseSync<any[]>('hydration_log', []);
  const [history, setHistory] = useFirebaseSync<Record<string, number>>('hydration_history', {});
  
  const [meals, setMeals] = useFirebaseSync<Record<string, any[]>>('fitness_meals', { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] });
  const [fitHistory, setFitHistory] = useFirebaseSync<Record<string, number>>('fitness_history', {});
  
  const [lastResetDate, setLastResetDate] = useFirebaseSync<string>('system_last_reset_date', '');

  useEffect(() => {
    const performReset = async (sleepDate: Date) => {
      const todayStr = new Date().toDateString();
      const lastDateStr = sleepDate.toDateString(); 

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

      // Update the marker
      setLastResetDate(todayStr);
    };

    const checkCalendar = async () => {
      try {
        const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(ICAL_URL)}`);
        const text = await res.text();
        const unfoldedText = text.replace(/\r?\n[ \t]/g, '');
        const lines = unfoldedText.split(/\r?\n/);
        
        let sleepStart: Date | null = null;
        let curr: any = { rrule: '' };

        const parseDate = (str: string) => {
          const cleanStr = str.replace(/[:;].*$/, '').trim();
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
          if (line.startsWith('BEGIN:VEVENT')) curr = { rrule: '' };
          else if (line.startsWith('END:VEVENT')) {
            if (curr.summary?.toLowerCase().includes('sleep') && curr.dtstart) {
              const start = parseDate(curr.dtstart);
              const today = new Date();
              
              // Handle recurring or specific instances
              // We want the instance that starts today or tomorrow morning
              if (start) {
                const diffHours = (start.getTime() - today.getTime()) / (1000 * 60 * 60);
                // If it's the closest sleep event (within next 24 hours)
                if (diffHours > -12 && diffHours < 24) {
                  if (!sleepStart || start.getTime() < sleepStart.getTime()) {
                    sleepStart = start;
                  }
                }
              }
            }
          }
          else if (line.startsWith('SUMMARY:')) curr.summary = line.substring(8);
          else if (line.startsWith('DTSTART')) curr.dtstart = line.split(':')[1] || line.split(';')[1]?.split(':')[1];
        }

        if (sleepStart) {
          const resetTime = new Date(sleepStart.getTime() - 3 * 60 * 60 * 1000);
          const now = new Date();
          const todayStr = now.toDateString();

          console.log(`[CalendarResetManager] Next Sleep: ${sleepStart.toLocaleString()}. Reset planned at: ${resetTime.toLocaleString()}`);

          if (now >= resetTime && lastResetDate !== todayStr) {
            performReset(sleepStart);
          }
        } else {
          // Fallback to midnight if no sleep event found
          const now = new Date();
          if (now.getHours() === 0 && lastResetDate !== now.toDateString()) {
             performReset(now);
          }
        }

      } catch (e) {
        console.error('CalendarResetManager error:', e);
      }
    };

    const interval = setInterval(checkCalendar, 5 * 60 * 1000); // Check every 5 minutes
    checkCalendar();
    return () => clearInterval(interval);
  }, [lastResetDate, glasses, history, meals, fitHistory, setGlasses, setLog, setHistory, setMeals, setFitHistory, setLastResetDate]);

  return null;
};
