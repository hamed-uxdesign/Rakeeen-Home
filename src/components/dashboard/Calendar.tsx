import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

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

const ICAL_URL = 'https://calendar.google.com/calendar/ical/9ce9f7279f0afeef711ae5c21eb29f4f087e8cb74aef36a9bbd0d58751e61587%40group.calendar.google.com/private-8496d29b04f57f4c8452f99dd5dbe203/basic.ics';

export const Calendar: React.FC<CalendarProps> = ({ navigate }) => {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [activeEvent, setActiveEvent] = useState<CalEvent | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    document.title = 'Rakeeen - Calendar';
  }, []);

  const parseICalDate = (str: string) => {
    if (!str) return null;
    try {
      const cleanStr = str.replace(/[:;].*$/, '').trim();
      if (cleanStr.length < 8) return null;
      const y = parseInt(cleanStr.slice(0, 4));
      const m = parseInt(cleanStr.slice(4, 6)) - 1;
      const d = parseInt(cleanStr.slice(6, 8));
      if (cleanStr.includes('T')) {
        const h = parseInt(cleanStr.slice(9, 11));
        const min = parseInt(cleanStr.slice(11, 13));
        const s = parseInt(cleanStr.slice(13, 15));
        const isUTC = cleanStr.endsWith('Z');
        if (isUTC) return new Date(Date.UTC(y, m, d, h, min, s));
        return new Date(y, m, d, h, min, s);
      }
      return new Date(y, m, d);
    } catch (e) {
      return null;
    }
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m > 0 ? m + 'm' : ''}`;
    return `${m}m`;
  };

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  useEffect(() => {
    const fetchICS = async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(ICAL_URL)}`);
        const text = await res.text();
        const unfoldedText = text.replace(/\r?\n[ \t]/g, '');
        const lines = unfoldedText.split(/\r?\n/);
        const tempEvents: CalEvent[] = [];
        let curr: any = { rrule: '' };
        
        const now = new Date();
        const startOfWindow = new Date(now);
        startOfWindow.setDate(now.getDate() - 7);
        startOfWindow.setHours(0, 0, 0, 0);
        
        const endOfWindow = new Date(now);
        endOfWindow.setDate(now.getDate() + 60);
        endOfWindow.setHours(23, 59, 59, 999);

        for (let line of lines) {
          if (line.startsWith('BEGIN:VEVENT')) {
            curr = { rrule: '' };
          } else if (line.startsWith('END:VEVENT')) {
            if (curr.summary && curr.dtstart && curr.dtend) {
              const baseStart = parseICalDate(curr.dtstart);
              const baseEnd = parseICalDate(curr.dtend);
              
              if (baseStart && baseEnd) {
                const durationMs = baseEnd.getTime() - baseStart.getTime();
                const untilDate = curr.rrule && curr.rrule.includes('UNTIL=') ? parseICalDate(curr.rrule.match(/UNTIL=([^;]+)/)?.[1] || '') : null;

                const checkAndAdd = (instStart: Date) => {
                  if (untilDate && instStart.getTime() > untilDate.getTime()) return;
                  const instEnd = new Date(instStart.getTime() + durationMs);
                  const durationMins = Math.floor(durationMs / 60000);
                  const timeStr = instStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                  tempEvents.push({ 
                    id: curr.summary + instStart.getTime(), 
                    title: curr.summary, 
                    startDate: instStart, 
                    endDate: instEnd, 
                    durationMins, 
                    timeStr 
                  });
                };

                if (curr.rrule && curr.rrule.includes('FREQ=DAILY')) {
                  const startLimit = new Date(Math.max(baseStart.getTime(), startOfWindow.getTime()));
                  const endLimit = new Date(Math.min(untilDate ? untilDate.getTime() : Infinity, endOfWindow.getTime()));
                  for (let d = new Date(startLimit); d <= endLimit; d.setDate(d.getDate() + 1)) {
                    const inst = new Date(d);
                    inst.setHours(baseStart.getHours(), baseStart.getMinutes(), baseStart.getSeconds());
                    checkAndAdd(inst);
                  }
                } else if (curr.rrule && curr.rrule.includes('FREQ=WEEKLY')) {
                  const startLimit = new Date(Math.max(baseStart.getTime(), startOfWindow.getTime()));
                  const endLimit = new Date(Math.min(untilDate ? untilDate.getTime() : Infinity, endOfWindow.getTime()));
                  const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
                  let byDay = curr.rrule.match(/BYDAY=([^;]+)/)?.[1] || days[baseStart.getDay()];
                  
                  for (let d = new Date(startLimit); d <= endLimit; d.setDate(d.getDate() + 1)) {
                    if (byDay.includes(days[d.getDay()])) {
                      const inst = new Date(d);
                      inst.setHours(baseStart.getHours(), baseStart.getMinutes(), baseStart.getSeconds());
                      checkAndAdd(inst);
                    }
                  }
                } else {
                  if (baseStart.getTime() >= startOfWindow.getTime() && baseStart.getTime() <= endOfWindow.getTime()) {
                    checkAndAdd(baseStart);
                  }
                }
              }
            }
            curr = { rrule: '' };
          }
          else if (line.startsWith('SUMMARY:')) curr.summary = line.substring(8);
          else if (line.startsWith('DTSTART')) curr.dtstart = line.split(':')[1] || line.split(';')[1]?.split(':')[1];
          else if (line.startsWith('DTEND')) curr.dtend = line.split(':')[1] || line.split(';')[1]?.split(':')[1];
          else if (line.startsWith('RRULE:')) curr.rrule = line;
        }

        const unique = tempEvents.filter((v, i, a) => a.findIndex(t => t.title === v.title && t.startDate.getTime() === v.startDate.getTime()) === i);
        unique.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
        setEvents(unique);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchICS();
    const interval = setInterval(fetchICS, 5 * 60 * 1000);
    return () => clearInterval(interval);
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

  const adjustDate = (days: number) => {
    const next = new Date(selectedDate);
    next.setDate(selectedDate.getDate() + days);
    setSelectedDate(next);
  };

  const getDaysStrip = () => {
    const strip = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(selectedDate);
      d.setDate(selectedDate.getDate() + i);
      strip.push(d);
    }
    return strip;
  };

  const selectedDateStr = selectedDate.toDateString();
  const todayStr = new Date().toDateString();

  const dayEvents = events.filter(e => {
    const startsOnDay = e.startDate.toDateString() === selectedDateStr;
    const endsOnDay = e.endDate.toDateString() === selectedDateStr;
    const dayStart = new Date(selectedDate); dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(selectedDate); dayEnd.setHours(23,59,59,999);
    const spansDay = e.startDate.getTime() < dayStart.getTime() && e.endDate.getTime() > dayEnd.getTime();
    return startsOnDay || endsOnDay || spansDay;
  });

  return (
    <div className="min-h-screen bg-bg text-ink py-12 px-6 md:px-12 lg:px-20 font-sans-main flex flex-col transition-colors duration-300">
      
      {/* HEADER */}
      <header className="w-full max-w-[1000px] mx-auto mb-12">
        {/* Breadcrumb / Back */}
        <div className="flex items-center gap-2 mb-8">
          <button
            onClick={() => navigate('home')}
            className="flex items-center gap-2 text-ink/40 hover:text-ink transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-mono-main text-[10px] uppercase tracking-[0.25em] font-bold">Home</span>
          </button>
          <ChevronRight size={12} className="text-ink/20" />
          <span className="font-mono-main text-[10px] uppercase tracking-[0.25em] font-bold text-ink/50">Calendar</span>
        </div>

        <div className="flex flex-col">
          <h1 className="font-sans-main text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-ink">
            CALENDAR
          </h1>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="w-full max-w-[1000px] mx-auto flex flex-col gap-6">

        {/* DATE NAVIGATION STRIP */}
        <div className="brutalist-card no-lift p-4 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <button 
              onClick={() => adjustDate(-1)}
              className="w-10 h-10 border border-ink flex items-center justify-center hover:bg-ink/5 transition-colors cursor-pointer"
            >
              <ArrowLeft size={18} />
            </button>
            
            <div className="text-center flex flex-col items-center">
              <span className="font-sans-main text-lg sm:text-xl font-black uppercase tracking-tight">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
              {selectedDateStr !== todayStr && (
                <button
                  onClick={() => {
                    const d = new Date();
                    d.setHours(0,0,0,0);
                    setSelectedDate(d);
                  }}
                  className="font-mono-main text-[9px] uppercase tracking-widest text-forest font-black border-b border-forest/30 mt-1 cursor-pointer"
                >
                  Go to Today
                </button>
              )}
            </div>

            <button 
              onClick={() => adjustDate(1)}
              className="w-10 h-10 border border-ink flex items-center justify-center hover:bg-ink/5 transition-colors cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* 7-Day Quick Strip */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 border-t border-ink/10 pt-4">
            {getDaysStrip().map((date, idx) => {
              const isSel = date.toDateString() === selectedDateStr;
              const isToday = date.toDateString() === todayStr;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    const d = new Date(date);
                    d.setHours(0,0,0,0);
                    setSelectedDate(d);
                  }}
                  className={`py-3 flex flex-col items-center justify-center border transition-all cursor-pointer ${
                    isSel 
                      ? 'border-ink bg-[var(--ink)] text-[var(--paper)]' 
                      : isToday 
                        ? 'border-forest text-forest bg-forest/5' 
                        : 'border-ink/15 hover:border-ink/50 bg-[var(--paper-dark)] text-ink/60'
                  }`}
                  style={{ borderRadius: 0 }}
                >
                  <span className="font-mono-main text-[9px] font-bold uppercase tracking-wider mb-1">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className="font-sans-main text-lg font-black leading-none">
                    {date.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ACTIVE SESSION CARD (Only visible if showing today, fast layout-friendly fade) */}
        {selectedDateStr === todayStr && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
          >
            {activeEvent ? (
              <div className="brutalist-card no-lift border-l-4 border-l-forest bg-forest/5 p-6 sm:p-8 text-center mb-6">
                 <div className="text-[10px] sm:text-xs font-black text-forest uppercase tracking-[0.25em] mb-4">● Active Session</div>
                 <h3 className="text-3xl sm:text-4xl font-black text-ink mb-4">{activeEvent.title}</h3>
                 {timeLeft < 60 && (
                   <div className="text-xl sm:text-2xl font-black text-forest tracking-tighter">
                     {timeLeft} 
                     <span className="text-[10px] sm:text-xs uppercase ml-2 opacity-50 font-black tracking-[0.2em] whitespace-nowrap inline-block">
                       minutes remaining
                     </span>
                   </div>
                 )}
              </div>
            ) : (
              <div className="brutalist-dashed-card no-lift p-6 text-center bg-paper/30 mb-6">
                 <p className="text-[10px] sm:text-xs text-ink/20 font-black uppercase tracking-widest">Quiet period — No active events</p>
              </div>
            )}
          </motion.div>
        )}

        {/* AGENDA SECTION */}
        <div className="flex flex-col gap-4">
          <h2 className="font-mono-main text-[10px] uppercase font-black tracking-[0.3em] text-ink/20">
            {selectedDateStr === todayStr ? "Today's Agenda" : "Day's Agenda"}
          </h2>
          
          <motion.div
            key={selectedDateStr}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="flex flex-col gap-4"
          >
            {loading ? (
              <div className="py-12 text-center text-ink/20 font-black uppercase tracking-widest text-sm animate-pulse">Syncing Cloud Calendar...</div>
            ) : dayEvents.length === 0 ? (
              <div className="brutalist-dashed-card no-lift py-12 text-center text-ink/20 font-black uppercase tracking-widest text-sm">Not Busy</div>
            ) : dayEvents.map((task) => {
              const isActive = selectedDateStr === todayStr && activeEvent?.id === task.id;
              return (
                <div 
                  key={task.id} 
                  className={`p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center transition-all duration-300 border border-ink ${isActive ? 'border-l-4 border-l-forest bg-forest/5' : 'bg-paper-dark'}`}
                >
                   <div className="flex items-center gap-4">
                     <div className="flex flex-col">
                        <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isActive ? 'text-forest' : 'text-ink/30'}`}>{task.timeStr}</div>
                        <div className="text-xl sm:text-2xl font-black text-ink tracking-tighter">{task.title}</div>
                     </div>
                   </div>
                   <div className="text-left sm:text-right mt-3 sm:mt-0">
                      <div className="text-[9px] font-black text-ink/20 uppercase tracking-widest mb-1">Duration</div>
                      <div className="text-lg font-black text-ink/60 tabular-nums">{formatDuration(task.durationMins)}</div>
                   </div>
                </div>
              );
            })}
          </motion.div>
        </div>

      </main>
    </div>
  );
};
