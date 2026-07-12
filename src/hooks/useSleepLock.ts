import { useEffect, useState } from 'react';
import { usePrayer } from './usePrayer';

// True from the real Isha adhan time until the real Fajr adhan time the next morning —
// both pulled fresh from the prayer API every day. Falls back to 9:00 PM / 4:00 AM if
// prayer times haven't loaded yet.
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

  const [ishaH, ishaM] = (times?.Isha || '21:00').split(':').map(Number);
  const todayIsha = new Date(now);
  todayIsha.setHours(ishaH, ishaM, 0, 0);

  return now >= todayIsha || now < todayFajr;
}
