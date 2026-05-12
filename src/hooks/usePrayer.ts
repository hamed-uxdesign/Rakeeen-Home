import { useState, useEffect, useCallback } from 'react';

export const usePrayer = () => {
  const [times, setTimes] = useState<Record<string, string>>({});
  const [hijri, setHijri] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [nextPrayer, setNextPrayer] = useState<{ name: string, time: string, countdown: string, remainingMinutes: number } | null>(null);

  const fetchPrayerTimes = async () => {
    try {
      const d = new Date();
      const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      const response = await fetch(`https://api.aladhan.com/v1/timings/${dateStr}?latitude=31.0379&longitude=31.3815&method=5`);
      const data = await response.json();
      if (data.code === 200) {
        setTimes(data.data.timings);
        const h = data.data.date.hijri;
        setHijri(`${h.day} ${h.month.en} ${h.year}`);
      }
    } catch (error) {
      console.error('Failed to fetch prayer times', error);
    } finally {
      setLoading(false);
    }
  };

  const updateNextPrayer = useCallback(() => {
    if (!times || Object.keys(times).length === 0) return;
    
    const now = new Date();
    const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    let found = null;

    for (const name of prayerNames) {
      const timeStr = times[name];
      if (!timeStr) continue;
      const [h, m] = timeStr.split(':').map(Number);
      const pDate = new Date(now);
      pDate.setHours(h, m, 0, 0);

      if (pDate > now) {
        const diffMs = pDate.getTime() - now.getTime();
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        found = { 
          name, 
          time: timeStr, 
          countdown: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
          remainingMinutes: mins
        };
        break;
      }
    }

    if (!found) {
        // If all prayers passed, next is Fajr tomorrow
        const timeStr = times['Fajr'];
        found = { name: 'Fajr', time: timeStr, countdown: '--:--', remainingMinutes: 999 };
    }
    setNextPrayer(found as any);
  }, [times]);

  useEffect(() => {
    fetchPrayerTimes();
  }, []);

  useEffect(() => {
    updateNextPrayer();
    const timer = setInterval(updateNextPrayer, 1000);
    return () => clearInterval(timer);
  }, [updateNextPrayer]);

  return { times, nextPrayer, loading, hijri };
};
