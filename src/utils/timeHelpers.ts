export function formatTime(sec: number): string {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function addMinutes(timeStr: string, mins: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function getLogicalDate(): Date {
  const now = new Date();
  const nextSleepStr = localStorage.getItem('system_next_sleep_time');
  if (nextSleepStr) {
    try {
      const nextSleep = new Date(nextSleepStr);
      if (!isNaN(nextSleep.getTime())) {
        const resetTime = new Date(nextSleep.getTime() - 3 * 60 * 60 * 1000);
        // Only subtract 24 hours if we are on the same calendar day as the sleep event
        // but we haven't reached the reset time yet (i.e., early morning before sleeping).
        if (now.toDateString() === nextSleep.toDateString() && now < resetTime) {
          const logical = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          return logical;
        }
        return now;
      }
    } catch (e) {
      console.error('Error parsing next sleep time', e);
    }
  }

  // Fallback to 2:00 AM reset
  if (now.getHours() < 2) {
    const logical = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return logical;
  }
  return now;
}

export function getTodayIdx(): number {
  const day = getLogicalDate().getDay();
  return day === 0 ? 6 : day - 1;
}

export function getPomoLogicalDate(): Date {
  const now = new Date();
  if (now.getHours() < 4) {
    const logical = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return logical;
  }
  return now;
}

export function getPomoTodayIdx(): number {
  const day = getPomoLogicalDate().getDay();
  return day === 0 ? 6 : day - 1;
}
