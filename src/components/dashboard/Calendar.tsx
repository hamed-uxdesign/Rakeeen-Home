import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';

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
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
        const todayTime = todayStart.getTime();
        const tomorrowTime = todayEnd.getTime();
        const todayStr = now.toDateString();

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
                  
                  const startsToday = instStart.toDateString() === todayStr;
                  const endsToday = instEnd.toDateString() === todayStr;
                  const spansToday = instStart.getTime() < todayTime && instEnd.getTime() > tomorrowTime;

                  if (startsToday || endsToday || spansToday) {
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
                  }
                };

                if (curr.rrule && curr.rrule.includes('FREQ=DAILY')) {
                  if (baseStart.getTime() <= tomorrowTime) {
                    const inst = new Date(todayStart);
                    inst.setHours(baseStart.getHours(), baseStart.getMinutes(), baseStart.getSeconds());
                    checkAndAdd(inst);
                  }
                } else if (curr.rrule && curr.rrule.includes('FREQ=WEEKLY')) {
                  if (baseStart.getTime() <= tomorrowTime) {
                    const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
                    const targetDay = todayStart.getDay();
                    let byDay = curr.rrule.match(/BYDAY=([^;]+)/)?.[1] || days[baseStart.getDay()];
                    if (byDay.includes(days[targetDay])) {
                      const inst = new Date(todayStart);
                      inst.setHours(baseStart.getHours(), baseStart.getMinutes(), baseStart.getSeconds());
                      checkAndAdd(inst);
                    }
                  }
                } else {
                  checkAndAdd(baseStart);
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

        {/* ACTIVE SESSION CARD */}
        {activeEvent ? (
          <div className="brutalist-card no-lift border-l-4 border-l-forest bg-forest/5 p-6 sm:p-8 text-center">
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
          <div className="brutalist-dashed-card no-lift p-6 text-center bg-paper/30">
             <p className="text-[10px] sm:text-xs text-ink/20 font-black uppercase tracking-widest">Quiet period — No active events</p>
          </div>
        )}

        {/* AGENDA SECTION */}
        <div className="flex flex-col gap-4">
          <h2 className="font-mono-main text-[10px] uppercase font-black tracking-[0.3em] text-ink/20">Today's Agenda</h2>
          
          <div className="flex flex-col gap-4">
            {loading ? (
              <div className="py-12 text-center text-ink/20 font-black uppercase tracking-widest text-sm animate-pulse">Syncing Cloud Calendar...</div>
            ) : events.length === 0 ? (
              <div className="brutalist-dashed-card no-lift py-12 text-center text-ink/20 font-black uppercase tracking-widest text-sm">Not Busy</div>
            ) : events.map((task) => {
              const isActive = activeEvent?.id === task.id;
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
          </div>
        </div>

      </main>
    </div>
  );
};
