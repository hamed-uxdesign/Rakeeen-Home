import { useEffect, useState } from 'react';
import { usePrayer } from './usePrayer';

// True from 9:00 PM (sleep time) until the real Fajr time (from the prayer API,
// refreshed daily) the next morning. Falls back to 4:00 AM if prayer times
// haven't loaded yet.
export function useSleepLock(): boolean {
  const { times } = usePrayer();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const [fajrH, fajrM] = (times?.Fajr || '04:00').split(':').map(Number);
  const todayFajr = new Date(now);
  todayFajr.setHours(fajrH, fajrM, 0, 0);
  const todayNine = new Date(now);
  todayNine.setHours(21, 0, 0, 0);

  return now >= todayNine || now < todayFajr;
}
