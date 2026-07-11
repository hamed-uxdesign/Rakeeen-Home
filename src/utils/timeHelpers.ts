export function formatTime(sec: number): string {
  const totalMins = Math.floor(sec / 60);
  const m = totalMins >= 100 ? String(totalMins) : String(totalMins).padStart(2, '0');
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
  // Fajr-Isha schedule: midnight–4am is still the previous logical day
  if (now.getHours() < 4) {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
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
