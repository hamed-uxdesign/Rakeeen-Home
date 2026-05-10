import React, { useState, useEffect } from 'react';
import { BackBtn } from '../layout/Common';
import { PageHeader } from '../ui/UIComponents';

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
      try {
        const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(ICAL_URL)}`);
        const text = await res.text();
        const unfoldedText = text.replace(/\r?\n[ \t]/g, '');
        const lines = unfoldedText.split(/\r?\n/);
        const tempEvents: CalEvent[] = [];
        let curr: any = { rrule: '' };
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        const todayTime = todayStart.getTime();
        const tomorrowTime = todayEnd.getTime();

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
                  
                  // ABSOLUTE SINGLE DAY CHECK
                  const todayStr = new Date().toDateString();
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
                  // Only if the recurring series started before or on today
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
                  // Non-recurring: must be today
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
    <div className="max-w-2xl mx-auto py-6 sm:py-12 px-4 sm:px-6 min-h-screen">
      <BackBtn onClick={() => navigate('home')} />
      <PageHeader 
        title="Calendar" 
        subtitle="Schedule & Agenda" 
      />

      {activeEvent ? (
        <div 
          className="p-6 sm:p-12 text-center mb-8 sm:mb-12 animate-scale-in"
          style={{ 
            backgroundColor: 'var(--paper)',
            border: '2px solid var(--forest)',
            borderLeftWidth: '8px',
            borderRadius: 'var(--radius-organic)',
          }}
        >
           <div className="text-[10px] sm:text-xs font-black text-forest uppercase tracking-[0.2em] sm:tracking-[0.4em] mb-4 sm:mb-6">● Active Session</div>
           <h3 className="text-3xl sm:text-4xl font-black text-ink mb-4 sm:mb-6">{activeEvent.title}</h3>
           {timeLeft < 60 && (
             <div className="text-xl sm:text-2xl font-black text-forest tracking-tighter">
               {timeLeft} 
               <span className="text-[10px] sm:text-xs uppercase ml-2 sm:ml-4 opacity-50 font-black tracking-[0.2em] whitespace-nowrap inline-block">
                 minutes remaining
               </span>
             </div>
           )}
        </div>
      ) : (
        <div 
          className="p-6 sm:p-10 text-center mb-8 sm:mb-12 bg-paper/30"
          style={{ borderRadius: 'var(--radius-organic)' }}
        >
           <p className="text-[10px] sm:text-xs text-ink/20 font-black uppercase tracking-widest">Quiet period — No active events</p>
        </div>
      )}

      <div className="space-y-6">
        {loading ? (
          <div className="py-24 text-center text-ink/20 font-black uppercase tracking-widest text-sm animate-pulse">Syncing Cloud Calendar...</div>
        ) : events.length === 0 ? (
          <div className="py-24 text-center text-ink/20 font-black uppercase tracking-widest text-sm border-2 border-dashed border-ink/5" style={{ borderRadius: 'var(--radius-organic)' }}>Empty Horizon</div>
        ) : events.map((task) => {
          const isActive = activeEvent?.id === task.id;
          return (
            <div 
              key={task.id} 
              className={`p-6 sm:p-10 flex flex-col sm:flex-row justify-between items-start sm:items-center transition-all duration-500 ${isActive ? 'scale-100 sm:scale-[1.02]' : 'opacity-80 hover:opacity-100 hover:translate-x-1'}`}
              style={{
                backgroundColor: isActive ? 'var(--paper)' : 'var(--paper-dark)',
                border: isActive ? '2px solid var(--forest)' : 'none',
                borderLeftWidth: isActive ? '8px' : '0px',
                borderRadius: 'var(--radius-organic)'
              }}
            >
               <div className="flex items-center gap-4 sm:gap-8">
                 <div className={`w-1.5 h-12 ${isActive ? 'bg-forest' : 'bg-ink/5'}`} />
                 <div>
                    <div className={`text-[10px] sm:text-xs font-black uppercase tracking-widest mb-1 sm:mb-2 ${isActive ? 'text-forest' : 'text-ink/30'}`}>{task.timeStr}</div>
                    <div className="text-2xl sm:text-3xl font-black text-ink tracking-tighter">{task.title}</div>
                 </div>
               </div>
               <div className="text-left sm:text-right mt-4 sm:mt-0 pl-6 sm:pl-0">
                  <div className="text-[9px] sm:text-[10px] font-black text-ink/20 uppercase tracking-widest mb-1 sm:mb-2">Duration</div>
                  <div className="text-lg sm:text-xl font-black text-ink/60 tabular-nums">{formatDuration(task.durationMins)}</div>
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
