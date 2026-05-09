import React, { useState, useEffect } from 'react';
import { BackBtn } from '../layout/Common';

interface CalendarProps {
  navigate: (to: string) => void;
}

interface CalEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  timeStr: string;
  durationMins: number;
}

// Temporary URL (Returns 404 because it's public. User needs to replace with Secret iCal link)
const ICAL_URL = 'https://calendar.google.com/calendar/ical/hamed.rakeeen%40gmail.com/private-aa7a61a1272c8a39e1d8c9e1d8ecba50/basic.ics';

export const Calendar: React.FC<CalendarProps> = ({ navigate }) => {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [activeEvent, setActiveEvent] = useState<CalEvent | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    document.title = 'Rakeeen - Calendar';
  }, []);

  useEffect(() => {
    const fetchICS = async () => {
      try {
        const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(ICAL_URL)}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const text = await res.text();

        const lines = text.split(/\r?\n/);
        const parsedEvents: CalEvent[] = [];
        let curr: any = { rrule: '' };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let line of lines) {
          if (line.startsWith('BEGIN:VEVENT')) {
            curr = { id: Math.random().toString(), rrule: '' };
          } else if (line.startsWith('END:VEVENT')) {
            if (curr.title && curr.start && curr.end) {
              const baseStart = parseICalDate(curr.start);
              const baseEnd = parseICalDate(curr.end);
              const durationMs = baseEnd.getTime() - baseStart.getTime();

              const generateInstance = (offsetDays: number) => {
                const instStart = new Date(baseStart);
                const targetDate = new Date(today);
                targetDate.setDate(targetDate.getDate() + offsetDays);
                instStart.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
                const instEnd = new Date(instStart.getTime() + durationMs);
                return { start: instStart, end: instEnd };
              };

              let untilDate: Date | null = null;
              if (curr.rrule.includes('UNTIL=')) {
                const match = curr.rrule.match(/UNTIL=([0-9T]+Z?)/);
                if (match) untilDate = parseICalDate(match[1]);
              }

              const addIfMatches = (offsetDays: number) => {
                if (untilDate && untilDate.getTime() < today.getTime()) return; // Skip expired events
                const inst = generateInstance(offsetDays);
                const durationMins = Math.floor(durationMs / 60000);
                const timeStr = inst.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                parsedEvents.push({ id: curr.id + offsetDays, title: curr.title, startDate: inst.start, endDate: inst.end, durationMins, timeStr });
              };

              if (curr.rrule.includes('FREQ=DAILY')) {
                addIfMatches(-1); // Yesterday
                addIfMatches(0);  // Today
              } else if (curr.rrule.includes('FREQ=WEEKLY')) {
                const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
                const yestDate = new Date(today); yestDate.setDate(yestDate.getDate() - 1);
                
                let byDays = '';
                const byDayMatch = curr.rrule.match(/BYDAY=([^;]+)/);
                if (byDayMatch) {
                  byDays = byDayMatch[1];
                } else {
                  byDays = days[baseStart.getDay()];
                }
                
                if (byDays.includes(days[yestDate.getDay()])) addIfMatches(-1);
                if (byDays.includes(days[today.getDay()])) addIfMatches(0);
              } else {
                const durationMins = Math.floor(durationMs / 60000);
                const timeStr = baseStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                parsedEvents.push({ id: curr.id, title: curr.title, startDate: baseStart, endDate: baseEnd, durationMins, timeStr });
              }
            }
            curr = { rrule: '' };
          } else if (line.startsWith('SUMMARY:')) curr.title = line.substring(8);
          else if (line.startsWith('DTSTART')) curr.start = line.split(':')[1];
          else if (line.startsWith('DTEND')) curr.end = line.split(':')[1];
          else if (line.startsWith('RRULE:')) curr.rrule = line;
        }

        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

        const filteredEvents = parsedEvents.filter(e => e.startDate.getTime() <= todayEnd.getTime() && e.endDate.getTime() >= todayStart.getTime());
        filteredEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
        
        setEvents(filteredEvents);
      } catch (err) {
        console.error("ICS Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchICS();
  }, []);

  useEffect(() => {
    const checkActive = () => {
      const now = new Date().getTime();
      const active = events.find(e => now >= e.startDate.getTime() && now < e.endDate.getTime());
      if (active) {
        setActiveEvent(active);
        setTimeLeft(Math.ceil((active.endDate.getTime() - now) / 60000));
      } else {
        setActiveEvent(null);
      }
    };
    checkActive();
    const interval = setInterval(checkActive, 10000);
    return () => clearInterval(interval);
  }, [events]);

  const parseICalDate = (str: string) => {
    if (!str) return new Date();
    // basic parsing for YYYYMMDDTHHMMSSZ
    const y = parseInt(str.slice(0, 4));
    const m = parseInt(str.slice(4, 6)) - 1;
    const d = parseInt(str.slice(6, 8));
    if (str.includes('T')) {
      const h = parseInt(str.slice(9, 11));
      const min = parseInt(str.slice(11, 13));
      const s = parseInt(str.slice(13, 15));
      const isUTC = str.endsWith('Z');
      if (isUTC) return new Date(Date.UTC(y, m, d, h, min, s));
      return new Date(y, m, d, h, min, s);
    }
    return new Date(y, m, d);
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-5 sm:px-20 ml-10 sm:ml-auto">
      <BackBtn onClick={() => navigate('home')} />

      <header className="mb-10">
        <h2 className="text-4xl font-black text-ink mb-1">Calendar</h2>
        <p className="text-[10px] text-ink/30 tracking-[0.2em] font-black">Calendar view</p>
      </header>

      {/* Active Event Banner */}
      {activeEvent ? (
        <div className="mb-10 bg-forest/20 border-2 border-forest rounded-2xl p-6 text-center shadow-[4px_4px_0px_0px_var(--forest)] animate-scale-in">
          <p className="text-[10px] text-forest/70 tracking-[0.3em] font-black mb-2"><span className="text-orange-500">●</span> Happening now</p>
          <h3 className="text-3xl font-black text-forest mb-4">{activeEvent.title}</h3>
          <div className="inline-block bg-forest text-paper px-6 py-2 rounded-full font-black tracking-widest text-sm">
            {formatDuration(timeLeft)} left
          </div>
        </div>
      ) : (
        <div className="mb-10 bg-ink/5 border-2 border-ink/10 rounded-2xl p-6 text-center">
          <p className="text-xs text-ink/40 font-bold tracking-widest">No active event at the moment.</p>
        </div>
      )}

      <div className="relative mt-8">
        <div className="absolute -left-[24px] top-4 bottom-4 w-1 bg-ink/5" />

        {loading ? (
          <div className="text-center py-10 text-ink/40 font-bold tracking-widest">Syncing Google calendar...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-10 text-ink/40 font-bold tracking-widest">No events scheduled for today.</div>
        ) : events.map((task) => {
          const isActive = activeEvent?.id === task.id;
          return (
            <div key={task.id} className="flex relative mb-6">
              <div className={`absolute -left-[85px] w-[60px] text-right text-xs font-bold tracking-wider pt-5 ${isActive ? 'text-forest' : 'text-ink/40'}`}>
                {task.timeStr}
              </div>

              <div
                className={`w-full p-4 border-2 rounded-[var(--radius-btn)] relative overflow-hidden ${isActive ? 'bg-forest/10 border-forest' : 'bg-paper/20 border-ink/20'}`}
              >
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <div className="text-base text-ink font-bold font-serif mb-1">{task.title}</div>
                    <div className="text-[10px] text-ink/40 font-bold tracking-wider">
                      {task.timeStr} — {task.endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} <span className="opacity-50 mx-1">|</span> {formatDuration(task.durationMins)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
