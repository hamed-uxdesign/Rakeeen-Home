import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { uploadImage } from '../../utils/cloudinary';
import { Sun, Plus, Camera, MoreVertical, LogOut, Moon } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { usePomodoro } from '../../hooks/usePomodoro';
import { AppModal } from '../ui/AppModal';
import { getLogicalDate } from '../../utils/timeHelpers';
import { usePrayer } from '../../hooks/usePrayer';
import { DotMatrixText } from '../ui/DotMatrixText';
import { DMTimer, WavyProgressBar } from '../ui/TimerComponents';
import { useFinance } from '../../hooks/useFinance';

// Egypt summer: civil twilight ends ~8pm, astronomical dark ~9:30pm, pre-dawn ~3:30am
// Uses continuous time (h + m/60) for smooth per-minute gradation
function getNightDarkness(h: number, m: number): number {
  const t = h + m / 60;
  if (t >= 22 || t < 3)  return 1.0;
  if (t >= 20 && t < 22) return 0.25 + 0.75 * ((t - 20) / 2);
  if (t >= 19 && t < 20) return 0.1  + 0.15 * (t - 19);
  if (t >= 3  && t < 5)  return 1.0  - 0.85 * ((t - 3) / 2);
  if (t >= 5  && t < 6)  return 0.15 - 0.15 * (t - 5);
  return 0;
}

function getMoonPhase(date: Date): { illumination: number; r: number; g: number; b: number } {
  const knownNewMoon = new Date('2000-01-06T18:14:00Z');
  const lunation = 29.53058867;
  const elapsed = (date.getTime() - knownNewMoon.getTime()) / 86400000;
  const phase = ((elapsed % lunation) + lunation) % lunation;
  const illumination = 0.5 * (1 - Math.cos(2 * Math.PI * phase / lunation));
  // Purkinje shift: crescent = more blue (dimmer = more rod vision = bluer)
  //                 full moon = brighter = more silver-white, less shift
  // At crescent: rgb(175, 195, 245) — deep blue-silver
  // At full:     rgb(210, 218, 238) — silver-white with faint blue
  const r = Math.round(175 + 35 * illumination);
  const g = Math.round(195 + 23 * illumination);
  const b = Math.round(245 - 7  * illumination);
  return { illumination, r, g, b };
}

// Real-time moon position in the sky — azimuth (°) and altitude (°)
// Observer: Egypt, Mansoura (lat 31.0379°, lon 31.3815°)
function getMoonAltAz(date: Date): { altitude: number; azimuth: number } {
  const LAT = 31.0379;
  const LON = 31.3815;
  const toRad = (d: number) => d * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;

  // Days since J2000.0
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0;

  // Moon's orbital elements (simplified Jean Meeus)
  const L = ((218.316 + 13.176396 * d) % 360 + 360) % 360;
  const M = toRad(((134.963 + 13.064993 * d) % 360 + 360) % 360);
  const F = toRad(((93.272  + 13.229350 * d) % 360 + 360) % 360);

  const lambda = toRad(L + 6.289 * Math.sin(M));
  const beta   = toRad(5.128 * Math.sin(F));
  const eps    = toRad(23.4397 - 0.0000004 * d);

  // Equatorial coords
  const sinDec = Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lambda);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  const ra  = Math.atan2(
    Math.sin(lambda) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps),
    Math.cos(lambda)
  );

  // Greenwich Mean Sidereal Time → Local Sidereal Time
  const T = d / 36525;
  const gmst = ((280.46061837 + 360.98564736629 * d + 0.000387933 * T * T) % 360 + 360) % 360;
  const lst = toRad((gmst + LON + 360) % 360);

  // Hour angle
  let ha = lst - ra;

  // Horizontal coords
  const latRad = toRad(LAT);
  const sinAlt = Math.sin(latRad) * Math.sin(dec) + Math.cos(latRad) * Math.cos(dec) * Math.cos(ha);
  const altitude = toDeg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));

  const cosAz = (Math.sin(dec) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
  let azimuth = toDeg(Math.acos(Math.max(-1, Math.min(1, cosAz))));
  if (Math.sin(ha) > 0) azimuth = 360 - azimuth;

  return { altitude, azimuth };
}

interface HomeProps {
  navigate: (to: string) => void;
}

// Persists across Home remounts — glow only animates in ONCE per night
let _moonGlowPersisted = false;
// Persists last active card so remount starts on the correct card instantly
let _lastActiveCardId: 'water' | 'pomodoro' | 'fitness' | 'prayer' | 'calendar' | 'finance' = 'water';
// Persists greeting name so it doesn't change on every remount
const _NAMES = ['Hamed', 'Ghorab', 'Bommy', 'Shahyn', 'Rakeeen'];
let _persistedGreetingName = _NAMES[Math.floor(Math.random() * _NAMES.length)];


const MaskedValue: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <span className={`relative inline-block cursor-pointer select-none ${className}`}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
    >
      <span className="absolute inset-0 flex items-center justify-start transition-opacity duration-200"
        style={{ opacity: revealed ? 0 : 1, pointerEvents: 'none' }}
        aria-hidden>
        <svg width="2.2em" height="0.8em" viewBox="0 0 44 14" fill="none">
          <style>{`@keyframes mvr{to{transform:rotate(360deg)}}@keyframes mvrr{to{transform:rotate(-360deg)}}`}</style>
          {[0,1,2].map(i => {
            const cx = 7 + i * 15, cy = 7, r = 4;
            const anim = i === 1 ? 'mvrr' : 'mvr';
            return (
              <g key={i} style={{ animation: `${anim} ${2 + i * 0.5}s linear infinite`, transformOrigin: `${cx}px ${cy}px`, opacity: 0.25 + i * 0.2 }}>
                <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                <line x1={cx - r * 0.5} y1={cy - r * 0.866} x2={cx + r * 0.5} y2={cy + r * 0.866} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                <line x1={cx + r * 0.5} y1={cy - r * 0.866} x2={cx - r * 0.5} y2={cy + r * 0.866} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              </g>
            );
          })}
        </svg>
      </span>
      <span className="transition-opacity duration-200" style={{ opacity: revealed ? 1 : 0 }}>
        {children}
      </span>
    </span>
  );
};

// Priority indicator — 6 dots orbiting a right-pointing triangle outline.
// The bright point chases the triangle clockwise: tip → upper → left → lower → tip.
// Reads as "active / locked-on" without being a circle, chevron, or spinner.
const SidebarActiveVector: React.FC = () => {
  // Triangle pointing right: tip, upper-right, upper-left, left-mid, lower-left, lower-right
  const pts: [number,number][] = [
    [18,12],  // 0 — tip (right)
    [11,4],   // 1 — upper corner
    [4,4],    // 2 — upper-left
    [4,12],   // 3 — left mid
    [4,20],   // 4 — lower-left
    [11,20],  // 5 — lower corner
  ];
  return (
    <svg width="22" height="22" viewBox="0 0 22 24" fill="currentColor" className="text-ink/80">
      {pts.map(([cx,cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.4"
          style={{ animation: 'vectorFade 1.5s ease-in-out infinite', animationDelay: `${i * 0.25}s` }} />
      ))}
    </svg>
  );
};

// ─── Section Vectors ────────────────────────────────────────────────────────
// Style matches Calendar DotMatrixVector: dot-matrix shapes, viewBox 0 0 24 24
// Each shape + animation expresses the section concept.
// size=20 → small card   size=36 → big card corner

// WATER — teardrop outline; animation fills bottom→top like water rising inside the drop
// fillLevel 0–1: fraction of the drop that's "full" — dots below glow, above are dim, level dot pulses
const WaterVector: React.FC<{ size?: number; fillLevel?: number }> = ({ size = 20, fillLevel = 0.5 }) => {
  const dots: [number, number, number][] = [
    [12,22,0], [9,21,1], [15,21,1], [7,18,2], [17,18,2],
    [5,14,3], [19,14,3], [7,9,4], [17,9,4], [9,5,5], [15,5,5], [12,2,6],
  ];
  const threshold = fillLevel * 6; // order 0–6
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      {dots.map(([cx, cy, order], i) => {
        const isAtLevel = Math.abs(order - threshold) < 0.8;
        const isBelow = order < threshold && !isAtLevel;
        return (
          <circle key={i} cx={cx} cy={cy} r="1.2"
            style={{
              opacity: isBelow ? 0.9 : isAtLevel ? undefined : 0.1,
              animation: isAtLevel ? 'vectorFade 2.5s ease-in-out infinite' : 'none',
              animationDelay: `${order * 0.28}s`,
              transition: 'opacity 0.8s ease',
            }} />
        );
      })}
    </svg>
  );
};

// FOCUS — hourglass; sand flows top→bottom, like time running out
// paused=true → hourglass is stuck (no focus today)
const FocusVector: React.FC<{ size?: number; paused?: boolean }> = ({ size = 20, paused = false }) => {
  const dots: [number, number, number][] = [
    [4,3,0], [8,3,0.1], [12,3,0.2], [16,3,0.1], [20,3,0],
    [8,8,0.55], [12,8,0.65], [16,8,0.55],
    [12,12,1.0],
    [8,16,1.35], [12,16,1.45], [16,16,1.35],
    [4,21,1.8], [8,21,1.9], [12,21,2.0], [16,21,1.9], [20,21,1.8],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      {dots.map(([cx, cy, delay], i) => (
        <circle key={i} cx={cx} cy={cy} r={i === 8 ? 1.5 : 1.2}
          style={{
            animation: 'vectorFade 3s ease-in-out infinite',
            animationDelay: `${delay}s`,
            animationPlayState: paused ? 'paused' : 'running',
          }} />
      ))}
    </svg>
  );
};


// CALENDAR — 7 dots arc over a base line (week fan view).
// The arc represents the days of a week curving overhead; today's dot (top of arc) pulses bright.
// Base line = the "table" the calendar sits on. Clean, readable as "time/dates".
const CalendarVector: React.FC<{ size?: number }> = ({ size = 20 }) => {
  // Arc: 7 day-dots arranged in a semicircle, center at (12,18), radius~14
  const arc: [number, number, number][] = [
    [1,  17, 0.55],  // Mon — far left
    [4,  10, 0.35],  // Tue
    [8,   4, 0.15],  // Wed
    [12,  2, 0],     // Thu — today (top of arc) — delay=0, first to glow
    [16,  4, 0.15],  // Fri
    [20, 10, 0.35],  // Sat
    [23, 17, 0.55],  // Sun — far right
  ];
  const todayIdx = 3;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      {/* Base line — the calendar "desk" */}
      {([3, 8, 12, 16, 21] as const).map((cx) => (
        <circle key={`b${cx}`} cx={cx} cy={22} r="0.9" opacity={0.2} />
      ))}
      {/* Arc of week-days */}
      {arc.map(([cx, cy, delay], i) => (
        <circle key={i} cx={cx} cy={cy}
          r={i === todayIdx ? 1.7 : 1.1}
          opacity={i === todayIdx ? 1 : 0.3}
          style={i === todayIdx ? { animation: 'vectorFade 2s ease-in-out infinite', animationDelay: '0s' } : { animation: 'vectorFade 2s ease-in-out infinite', animationDelay: `${delay}s` }} />
      ))}
    </svg>
  );
};

// PRAYER — crescent C-arc of dots; cascade lights like stars appearing at dusk
// paused=true → prayer is active now, deep stillness
const PrayerVector: React.FC<{ size?: number; paused?: boolean }> = ({ size = 20, paused = false }) => {
  const crescent: [number,number][] = [
    [12,2],[17,4],[20,8],[21,12],[20,16],[17,20],[12,22],[8,20],[7,16],[8,8],
  ];
  const stars: [number,number][] = [[3,6],[3,18],[4,12]];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      {crescent.map(([cx,cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.2"
          style={{
            animation: 'vectorFade 2.4s ease-in-out infinite',
            animationDelay: `${i * 0.24}s`,
            animationPlayState: paused ? 'paused' : 'running',
          }} />
      ))}
      {stars.map(([cx,cy], i) => (
        <circle key={`s${i}`} cx={cx} cy={cy} r="0.9"
          style={{
            animation: 'vectorFade 3s ease-in-out infinite',
            animationDelay: `${i * 0.9}s`,
            animationPlayState: paused ? 'paused' : 'running',
          }} />
      ))}
    </svg>
  );
};

// FINANCE — vintage coin face; outer ring + inner cross-hatch + center dot.
// Animation: shimmer sweeps clockwise around the coin edge.
const FinanceVector: React.FC<{ size?: number }> = ({ size = 20 }) => {
  // Outer ring — 12 dots like clock positions
  const ring: [number, number, number][] = [
    [12, 3,  0],    // 12
    [16.8, 4.2, 0.08], // 1
    [20.2, 7.8, 0.17], // 2
    [21, 12, 0.25], // 3
    [20.2, 16.2, 0.33], // 4
    [16.8, 19.8, 0.42], // 5
    [12, 21, 0.50], // 6
    [7.2, 19.8, 0.58], // 7
    [3.8, 16.2, 0.67], // 8
    [3, 12, 0.75], // 9
    [3.8, 7.8, 0.83], // 10
    [7.2, 4.2, 0.92], // 11
  ];
  // Inner £ symbol in dots (center of 24×24)
  const symbol: [number, number, number][] = [
    // top arc of £
    [10, 8, 0.1], [12, 7, 0.15], [14, 8, 0.20],
    // vertical stem
    [10, 10, 0.25], [10, 12, 0.30],
    // cross bar
    [10, 14, 0.35], [12, 14, 0.40],
    // base
    [9, 17, 0.45], [11, 17, 0.50], [13, 17, 0.55],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      {ring.map(([cx, cy, delay], i) => (
        <circle key={`r${i}`} cx={cx} cy={cy} r="1.1"
          style={{ animation: 'vectorFade 2.4s ease-in-out infinite', animationDelay: `${delay}s` }} />
      ))}
      {symbol.map(([cx, cy, delay], i) => (
        <circle key={`s${i}`} cx={cx} cy={cy} r="0.9"
          style={{ animation: 'vectorFade 2.4s ease-in-out infinite', animationDelay: `${delay + 0.3}s` }} />
      ))}
    </svg>
  );
};

// FITNESS — dumbbell/barbell; energy pulse travels left plate → bar → right plate.
// The shape is unmistakably "gym/strength". Animation = energy flowing through the lift.
// paused=true → workout done, bar is resting
const FitnessVector: React.FC<{ size?: number; paused?: boolean }> = ({ size = 20, paused = false }) => {
  const dots: [number, number, number][] = [
    [3, 8,  0], [3, 12, 0.06], [3, 16, 0.12],
    [7,  12, 0.22], [10, 12, 0.34], [14, 12, 0.46], [17, 12, 0.58],
    [21, 8,  0.68], [21, 12, 0.74], [21, 16, 0.80],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      {dots.map(([cx, cy, delay], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.3"
          style={{
            animation: 'vectorFade 1.4s ease-in-out infinite',
            animationDelay: `${delay}s`,
            animationPlayState: paused ? 'paused' : 'running',
          }} />
      ))}
    </svg>
  );
};


// ─── Monthly Fingerprint ────────────────────────────────────────────────────
const MonthFingerprint: React.FC<{
  monthKey: string;
  days: Record<string, { water: number; focus: number; workout: number }>;
  size?: number;
}> = ({ monthKey, days, size = 72 }) => {
  const cx = size / 2, cy = size / 2, maxR = size * 0.44;
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {Array.from({ length: daysInMonth }, (_, i) => {
        const dateKey = `${monthKey}-${String(i + 1).padStart(2, '0')}`;
        const d = days[dateKey] ?? null;
        const angle = (i / daysInMonth) * Math.PI * 2 - Math.PI / 2;
        const score = d ? Math.min(1, d.water / 12 * 0.4 + d.focus / 100 * 0.4 + (d.workout > 0 ? 1 : 0) * 0.2) : 0;
        const r = score > 0 ? maxR * (0.3 + score * 0.7) : maxR * 0.08;
        const x2 = cx + Math.cos(angle) * r;
        const y2 = cy + Math.sin(angle) * r;
        return (
          <line key={i} x1={cx} y1={cy} x2={x2} y2={y2}
            stroke="currentColor"
            strokeWidth={score > 0.5 ? 1.6 : 1}
            opacity={score > 0 ? 0.3 + score * 0.65 : 0.1} />
        );
      })}
    </svg>
  );
};

export const Home: React.FC<HomeProps> = ({ navigate }) => {
  const [activeCardId, setActiveCardId] = useState<'water' | 'pomodoro' | 'fitness' | 'prayer' | 'calendar' | 'finance'>(() => _lastActiveCardId);
  const [displayedCardId, setDisplayedCardId] = useState<'water' | 'pomodoro' | 'fitness' | 'prayer' | 'calendar' | 'finance'>(() => _lastActiveCardId);
  const [bigCardVisible, setBigCardVisible] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [lastManualClickTime, setLastManualClickTime] = useState<number>(0);
  // systemCardId tracks which card has system priority — independent of what user is viewing
  const [systemCardId, setSystemCardId] = useState<'water' | 'pomodoro' | 'fitness' | 'prayer' | 'calendar' | 'finance' | null>(null);
  const [avatarUrl, setAvatarUrl] = useFirebaseSync<string | null>('avatar_url', null);
  const [glasses, setGlasses] = useFirebaseSync<number>('hydration_glasses', 0);
  const [workouts] = useFirebaseSync<any[]>('fitness_workouts', []);
  const [financeBanks] = useFirebaseSync<Record<string, number>>('finance_banks', {});
  const [dailyHistory, setDailyHistory] = useFirebaseSync<Record<string, { water: number; focus: number; workout: number }>>('daily_history', {});
  const [dailyJournal, setDailyJournal] = useFirebaseSync<Record<string, string>>('daily_journal', {});
  const { pendingItems } = useFinance();
  const totalPhysical = Object.values(financeBanks).reduce((a, b) => a + (Number(b) || 0), 0);
  
  const workoutMinsToday = workouts
    .filter(w => w.date === getLogicalDate().toDateString())
    .reduce((a, b) => a + (Number(b.duration) || 0), 0);
    
  const {
    weekStats,
    todayIdx,
    running: pomodoroRunning,
    isOvertime: pomodoroOvertime,
    timeLeft,
    overtime,
    mode,
    focusDuration,
    breakDuration,
    start: pomodoroStart,
  } = usePomodoro();
  const focusMinutes = weekStats?.[todayIdx]?.minutes || 0;
  const focusHours = (focusMinutes / 60).toFixed(1).replace('.0', '');

  // Save today's snapshot whenever key data changes
  const todayKey = getLogicalDate().toISOString().slice(0, 10);
  useEffect(() => {
    if (glasses === 0 && focusMinutes === 0 && workoutMinsToday === 0) return;
    setDailyHistory(prev => {
      const existing = prev[todayKey] ?? { water: 0, focus: 0, workout: 0 };
      return {
        ...prev,
        [todayKey]: {
          water: Math.max(existing.water, glasses || 0),
          focus: Math.max(existing.focus, focusMinutes),
          workout: Math.max(existing.workout, workoutMinsToday),
        },
      };
    });
  }, [glasses, focusMinutes, workoutMinsToday]);

  // Compute 7-day pattern for emotional greeting awareness
  const weekPattern = (() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      return dailyHistory[key] ?? null;
    }).filter(Boolean) as { water: number; focus: number; workout: number }[];

    if (days.length < 3) return 'neutral';

    const score = (d: { water: number; focus: number; workout: number }) =>
      (d.water >= 8 ? 1 : 0) + (d.focus >= 30 ? 1 : 0) + (d.workout > 0 ? 1 : 0);

    const recent = days.slice(0, 3).map(score);
    const older  = days.slice(3).map(score);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg  = older.length ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;

    const allStrong  = recent.every(s => s >= 2);
    const allWeak    = recent.every(s => s === 0);
    const improving  = recentAvg > olderAvg + 0.5;
    const declining  = recentAvg < olderAvg - 0.5;

    if (allStrong)  return 'momentum';
    if (allWeak)    return 'slump';
    if (improving)  return 'rising';
    if (declining)  return 'fading';
    return 'neutral';
  })();


  // Generate one-line journal entry for a given day's snapshot
  const WORKOUT_DAYS = [0, 3]; // Sunday, Wednesday
  const generateJournalEntry = (dateKey: string, data: { water: number; focus: number; workout: number }) => {
    const d = new Date(dateKey + 'T12:00:00');
    const dateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const waterStr = data.water >= 10 ? 'water was strong' : data.water >= 6 ? 'water was decent' : data.water > 0 ? 'water was low' : 'no water logged';
    const focusStr = data.focus >= 60 ? `focus ran ${Math.round(data.focus / 60)}h` : data.focus > 0 ? `focus ran ${data.focus}m` : 'no focus';
    const parts = [waterStr, focusStr];
    if (WORKOUT_DAYS.includes(d.getDay())) {
      parts.push(data.workout > 0 ? `${data.workout}m workout` : 'no workout');
    }
    return `${dateStr} — ${parts.join(', ')}.`;
  };

  // Write yesterday's journal entry when the day rolls over
  const prevDateRef = useRef(getLogicalDate().toISOString().slice(0, 10));
  useEffect(() => {
    const interval = setInterval(() => {
      const currentDay = getLogicalDate().toISOString().slice(0, 10);
      if (currentDay !== prevDateRef.current) {
        const yesterdayKey = prevDateRef.current;
        prevDateRef.current = currentDay;
        const snap = dailyHistory[yesterdayKey];
        if (snap && !dailyJournal[yesterdayKey]) {
          const entry = generateJournalEntry(yesterdayKey, snap);
          setDailyJournal(prev => ({ ...prev, [yesterdayKey]: entry }));
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [dailyHistory, dailyJournal]);

  // Regenerate today's entry whenever data changes (so format updates apply immediately)
  useEffect(() => {
    const snap = dailyHistory[todayKey];
    if (!snap) return;
    if (snap.water === 0 && snap.focus === 0 && snap.workout === 0) return;
    const entry = generateJournalEntry(todayKey, snap);
    if (dailyJournal[todayKey] === entry) return;
    setDailyJournal(prev => ({ ...prev, [todayKey]: entry }));
  }, [dailyHistory, todayKey]);

  const [showFingerprint, setShowFingerprint] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorModal, setErrorModal] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme management state
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark-theme'));
  const [showMenu, setShowMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.body.classList.remove('dark-theme');
      setIsDark(false);
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.add('dark-theme');
      setIsDark(true);
      localStorage.setItem('theme', 'dark');
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-theme');
      setIsDark(true);
    } else {
      document.body.classList.remove('dark-theme');
      setIsDark(false);
    }
  }, []);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setAvatarUrl(url);
    } catch (err) {
      setErrorModal(true);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    if (pomodoroRunning || pomodoroOvertime) {
      setLogoutModal(true);
    } else {
      signOut(auth);
    }
  };

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    document.title = 'Rakeeen Home';
    return () => clearInterval(timer);
  }, []);

  // Show yesterday's journal entry automatically from 2:00 AM to 2:30 AM
  const isJournalTime = now.getHours() === 2 && now.getMinutes() < 30;
  // Build yesterday's key from local date components to avoid UTC offset issues
  const journalYesterdayKey = (() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const journalEntry = React.useMemo(() => {
    if (!isJournalTime) return null;
    // Saved entry
    if (dailyJournal[journalYesterdayKey]) return dailyJournal[journalYesterdayKey];
    // Generate on-the-fly from history if not yet saved
    const snap = dailyHistory[journalYesterdayKey];
    if (snap && (snap.water > 0 || snap.focus > 0 || snap.workout > 0)) {
      return generateJournalEntry(journalYesterdayKey, snap);
    }
    return null;
  }, [isJournalTime, dailyJournal, dailyHistory, journalYesterdayKey]);

  // Tracks whether the initial reveal has happened — set by auto-select once prayer data is ready
  const firstRevealDoneRef = useRef(false);

  // Big card fade transition when active card changes (only runs AFTER first reveal)
  useEffect(() => {
    _lastActiveCardId = activeCardId;
    if (!firstRevealDoneRef.current) return; // still waiting for first reveal from auto-select
    if (activeCardId !== displayedCardId) {
      setBigCardVisible(false);
      const t = setTimeout(() => {
        setDisplayedCardId(activeCardId);
        setBigCardVisible(true);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [activeCardId]);


  // Moon glow
  const moonData = getMoonPhase(now);
  const nightDarkness = getNightDarkness(now.getHours(), now.getMinutes());
  const moonPos = getMoonAltAz(now);
  // Map real azimuth → screen X: E(90°)=right(100%), S(180°)=center(50%), W(270°)=left(0%)
  const moonGradX = Math.max(0, Math.min(100, 100 - (moonPos.azimuth - 90) / 180 * 100)).toFixed(1);
  // Map altitude → screen Y: near horizon=25%, high in sky=0%
  const moonGradY = moonPos.altitude > 0
    ? Math.max(0, Math.min(25, (1 - moonPos.altitude / 75) * 25)).toFixed(1)
    : '30';
  // Fade intensity when moon is near/below horizon
  const horizonFade = moonPos.altitude < 5 ? Math.max(0, moonPos.altitude / 5) : 1;
  const moonIntensity = moonData.illumination * nightDarkness * horizonFade;
  const isNight = now.getHours() >= 20 || now.getHours() < 6;
  const [moonGlowVisible, setMoonGlowVisible] = useState(() => _moonGlowPersisted && isNight);
  const [moonTransition, setMoonTransition] = useState(() =>
    _moonGlowPersisted && isNight ? 'none' : 'opacity 8s ease-in'
  );
  useEffect(() => {
    if (isNight) {
      if (_moonGlowPersisted) {
        setMoonTransition('none');
        setMoonGlowVisible(true);
      } else {
        setMoonTransition('opacity 8s ease-in');
        const t = setTimeout(() => {
          setMoonGlowVisible(true);
          _moonGlowPersisted = true;
        }, 100);
        return () => clearTimeout(t);
      }
    } else {
      setMoonGlowVisible(false);
      _moonGlowPersisted = false;
    }
  }, [isNight]);

  const [greetingName, setGreetingName] = useState(() => _persistedGreetingName);

  // Schedule: works until 4am, sleeps 5am–11am, golden hour Egypt summer ~7–8pm
  const getGreeting = (h: number): { before: string; name: string; after: string } => {
    const n = greetingName.toUpperCase();
    // Data-aware: check most notable condition first
    const waterLow = typeof glasses === 'number' && glasses < 3 && h >= 14 && h < 22;
    const noFocus = focusMinutes === 0 && !pomodoroRunning && h >= 13 && h < 19;
    const isWorkoutDay = [0, 3].includes(now.getDay()); // Sunday=0, Wednesday=3
    const noWorkout = isWorkoutDay && workoutMinsToday === 0 && h >= 18 && h < 23;
    const hasPending = false; // removed from greeting — too unstable with API retries

    let before = '';
    // Pattern-aware phrases take priority over today-only conditions
    if (weekPattern === 'momentum')     before = 'THREE DAYS LOCKED IN ... KEEP THE RIVER MOVING ';
    else if (weekPattern === 'slump')   before = 'THE RIVER HAS BEEN LOW ALL WEEK ... ';
    else if (weekPattern === 'rising')  before = 'SOMETHING IS SHIFTING ... DON\'T STOP NOW ';
    else if (weekPattern === 'fading')  before = 'HAWK HAS BEEN DRIFTING ... COME BACK ';
    else if (waterLow)       before = 'RIVER IS LOW TODAY ... DRINK UP ';
    else if (noFocus)        before = 'HAWK HASN\'T MOVED YET ... ';
    else if (hasPending)     before = 'SOMETHING IS WAITING ... ';
    else if (noWorkout)      before = 'LION DIDN\'T HUNT TODAY ... ';
    else if (h >= 0 && h < 4)        before = 'OWLS ARE OUT ... AND SO ARE YOU ';
    else if (h >= 4 && h < 5)        before = 'BIRDS ALMOST READY ... ARE YOU ';
    else if (h >= 5 && h < 11)       before = 'TREES ARE WORKING ... REST UP ';
    else if (h >= 11 && h < 13)      before = 'BEES BEEN OUT FOR HOURS ... YOUR TURN ';
    else if (h >= 13 && h < 17)      before = 'PUSH WHILE THE SUN\'S STILL UP ... ';
    else if (h >= 17 && h < 19)      before = 'BIRDS HEADING HOME ... WRAP IT UP ';
    else if (h >= 19 && h < 20)      before = 'GOLDEN HOUR ... CATCH THE LIGHT ';
    else if (h >= 20 && h < 22)      before = 'FROGS ARE LOUD ... SLOW DOWN ';
    else                              before = 'NIGHT SETTLING IN ... OWL MODE ';
    return { before, name: n, after: '' };
  };

  const greetingParts = getGreeting(now.getHours());

  const [displayedGreeting, setDisplayedGreeting] = useState(greetingParts);
  const [greetingVisible, setGreetingVisible] = useState(true);

  // Fade transition when journal window opens or closes
  const prevJournalEntryRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevJournalEntryRef.current;
    const curr = journalEntry;
    if (prev === curr) return;
    prevJournalEntryRef.current = curr;
    setGreetingVisible(false);
    const t = setTimeout(() => setGreetingVisible(true), 600);
    return () => clearTimeout(t);
  }, [journalEntry]);
  useEffect(() => {
    if (greetingParts.before !== displayedGreeting.before) {
      setGreetingVisible(false);
      const nextName = (() => {
        const others = _NAMES.filter(n => n.toUpperCase() !== displayedGreeting.name);
        return others[Math.floor(Math.random() * others.length)];
      })();
      const t = setTimeout(() => {
        _persistedGreetingName = nextName;
        setGreetingName(nextName);
        setDisplayedGreeting({ before: greetingParts.before, name: nextName.toUpperCase(), after: '' });
        setGreetingVisible(true);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [greetingParts.before]);

  const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const [timeOnly, amPm] = timeString.split(' ');
  
  const { times, nextPrayer, loading: prayerLoading } = usePrayer();

  const getCardPrayerInfo = () => {
    if (prayerLoading || !times || Object.keys(times).length === 0) {
      return { name: 'PRAYER', info: 'LOADING...' };
    }
    
    const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    let activePrayer = null;
    
    for (const name of prayerNames) {
      const timeStr = times[name];
      if (!timeStr) continue;
      const [h, m] = timeStr.split(':').map(Number);
      const pDate = new Date(now);
      pDate.setHours(h, m, 0, 0);
      const diffMins = (now.getTime() - pDate.getTime()) / 60000;
      if (diffMins >= 0 && diffMins <= 15) {
        activePrayer = name;
        break;
      }
    }
    
    if (activePrayer) {
      return {
        name: activePrayer,
        info: 'ACTIVE NOW'
      };
    }
    
    if (nextPrayer) {
      const timeStr = nextPrayer.time;
      let infoStr = '';
      if (timeStr) {
        let [h, m] = timeStr.split(':').map(Number);
        const suffix = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        infoStr = `ATHAN AT ${h}:${String(m).padStart(2, '0')} ${suffix}`;
      } else {
        infoStr = 'UPCOMING';
      }
      return {
        name: nextPrayer.name,
        info: infoStr
      };
    }
    
    return { name: 'PRAYER', info: 'NO DATA' };
  };

  const cardPrayer = getCardPrayerInfo();
  
  // Format English Date
  const dateStringEn = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Smart active card prioritizing logic based on real-time activity
  useEffect(() => {
    const getNextPrayerCloseness = () => {
      if (!nextPrayer || !nextPrayer.time) return false;
      const [h, m] = nextPrayer.time.split(':').map(Number);
      const pDate = new Date(now);
      pDate.setHours(h, m, 0, 0);
      if (pDate.getTime() < now.getTime()) {
        pDate.setDate(pDate.getDate() + 1);
      }
      const diffMins = (pDate.getTime() - now.getTime()) / 60000;
      return diffMins > 0 && diffMins <= 15;
    };

    const isPrayerActiveOrClose = cardPrayer.info === 'ACTIVE NOW' || getNextPrayerCloseness();

    // Determine which card has real system priority (not just default)
    let priorityCardId: 'pomodoro' | 'prayer' | null = null;
    if (pomodoroRunning || pomodoroOvertime) {
      priorityCardId = 'pomodoro';
    } else if (isPrayerActiveOrClose) {
      priorityCardId = 'prayer';
    }

    // systemCardId tracks the priority card — always updated, user interaction doesn't clear it
    setSystemCardId(priorityCardId ?? 'water');

    const targetCardId = priorityCardId ?? 'water';

    // First reveal: wait until prayer data is ready (nextPrayer computed from localStorage or API)
    // This ensures we show the CORRECT card on first paint — no flash of Water before switching
    if (!firstRevealDoneRef.current) {
      const prayerDataReady = nextPrayer !== null || Object.keys(times).length === 0;
      if (!prayerDataReady) return; // wait one more tick
      firstRevealDoneRef.current = true;
      _lastActiveCardId = targetCardId;
      setDisplayedCardId(targetCardId);
      setActiveCardId(targetCardId);
      requestAnimationFrame(() => setBigCardVisible(true));
      return;
    }

    // Subsequent auto-selects: only if user hasn't manually clicked in 3 min
    if (Date.now() - lastManualClickTime < 180000) return;
    if (activeCardId !== targetCardId) {
      setActiveCardId(targetCardId);
    }
  }, [
    pomodoroRunning,
    pomodoroOvertime,
    cardPrayer.info,
    nextPrayer,
    now,
    lastManualClickTime,
    activeCardId
  ]);

  // Quick action function to increment water glasses
  // Vector emotional states
  const waterFillLevel = Math.min(1, (glasses || 0) / 14);
  const focusPaused = focusMinutes === 0 && !pomodoroRunning;
  const fitnessPaused = workoutMinsToday > 0;
  const prayerPaused = cardPrayer.info === 'ACTIVE NOW';

  const addWaterCup = (e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering card navigation
    if (glasses < 14) {
      setGlasses(glasses + 1);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-ink py-6 md:py-12 px-6 md:px-12 lg:px-20 font-sans-main flex flex-col justify-between transition-colors duration-300 relative">
      {/* Moon glow — rises slowly at night, fades at dawn */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at ${moonGradX}% ${moonGradY}%, rgba(${moonData.r}, ${moonData.g}, ${moonData.b}, ${(moonIntensity * 0.18).toFixed(3)}) 0%, rgba(${moonData.r - 20}, ${moonData.g - 15}, ${moonData.b}, ${(moonIntensity * 0.07).toFixed(3)}) 40%, transparent 68%)`,
          opacity: moonGlowVisible ? 1 : 0,
          transition: moonTransition === 'none'
            ? 'background 60s linear'
            : `${moonTransition}, background 60s linear`,
          zIndex: 0,
        }}
      />
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

      {/* 1. HEADER SECTION */}
      <header className="w-full max-w-[1400px] mx-auto mb-6 md:mb-12 lg:mb-16 flex flex-row items-center justify-between gap-4 border-b border-ink/10 pb-4 md:pb-6">
        <div>
          <h1 className="font-sans-main text-lg sm:text-xl md:text-2xl tracking-tight select-none" style={{ color: 'color-mix(in srgb, var(--ink) 55%, transparent)', opacity: greetingVisible ? 1 : 0, transition: 'opacity 0.5s ease' }}>
            {journalEntry
              ? <span className="font-light">{journalEntry}</span>
              : <>
                  <span className="font-light">{displayedGreeting.before}</span>
                  <span className="font-medium cursor-pointer" onClick={() => setShowFingerprint(true)} style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 20%, transparent)' }}>{displayedGreeting.name}</span>
                  <span className="font-light">{displayedGreeting.after}</span>
                </>
            }
          </h1>
        </div>

        {/* PROFILE CARD & ACTIONS */}
        <div className="flex items-center gap-4 relative" ref={dropdownRef}>
          <div 
            onClick={handleAvatarClick}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-ink bg-paper-dark relative overflow-hidden cursor-pointer group flex items-center justify-center transition-transform hover:scale-105"
          >
            {uploading ? (
              <div className="text-[8px] font-mono-main font-bold animate-pulse text-ink/80 text-center">Syncing</div>
            ) : avatarUrl ? (
              <>
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-paper-dark/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera size={14} className="text-ink" />
                </div>
              </>
            ) : (
              <span className="text-xl font-black font-sans-main text-ink/30">R</span>
            )}
          </div>

          {/* Three dots dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              className="w-10 h-10 border border-ink flex items-center justify-center text-ink hover:bg-ink/5 transition-colors cursor-pointer"
              title="Menu"
            >
              <MoreVertical size={20} />
            </button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="absolute right-0 mt-2 z-50 bg-[var(--paper-dark)] border border-ink p-2 shadow-lg flex items-center gap-2"
                  style={{ borderRadius: 0 }}
                >
                  {/* Theme Button */}
                  <button
                    onClick={toggleTheme}
                    className="w-10 h-10 border border-ink flex items-center justify-center text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                    title={isDark ? 'Switch to Light' : 'Switch to Dark'}
                  >
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                  </button>

                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="w-10 h-10 border border-ink flex items-center justify-center text-rust hover:bg-rust/5 transition-colors cursor-pointer"
                    title="Log out"
                  >
                    <LogOut size={18} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* 2. STAGE MANAGER TWO-COLUMN LAYOUT */}
      <main className="w-full max-w-[1400px] mx-auto flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 lg:gap-8 mb-6 lg:mb-16 items-stretch">
        
        {/* Left stack (Stage Manager dock) */}
        <div className="flex lg:flex-col gap-3 lg:gap-4 overflow-x-auto lg:overflow-visible pb-3 lg:pb-0 shrink-0 lg:w-[230px] scrollbar-none -mx-6 px-6 lg:mx-0 lg:px-0">
          {([
            {
              id: 'water',
              title: 'Water',
              Vector: WaterVector,
              route: 'water',
              isRunning: false,
              metric: `${glasses} / 14`,
              subText: 'GLASSES TODAY',
            },
            {
              id: 'pomodoro',
              title: 'Your Focus',
              Vector: FocusVector,
              route: 'pomodoro',
              isRunning: false,
              metric: pomodoroRunning || pomodoroOvertime
                ? (pomodoroOvertime ? `+${Math.floor(overtime / 60)}m` : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`)
                : `${focusMinutes > 0 ? focusHours : '0'}h`,
              subText: pomodoroRunning || pomodoroOvertime ? (pomodoroOvertime ? 'OVERTIME' : mode.toUpperCase()) : 'FOCUSED TODAY',
            },
            {
              id: 'calendar',
              title: 'Calendar',
              Vector: CalendarVector,
              route: 'calendar',
              isRunning: false,
              metric: `${now.getDate()} ${now.toLocaleDateString('en-US', { month: 'short' })}`,
              subText: now.toLocaleDateString('en-US', { weekday: 'long' }),
            },
            {
              id: 'prayer',
              title: 'Devotion',
              Vector: PrayerVector,
              route: 'prayer',
              isRunning: cardPrayer.info === 'ACTIVE NOW',
              metric: cardPrayer.name,
              subText: cardPrayer.info,
            },
            {
              id: 'fitness',
              title: 'Training',
              Vector: FitnessVector,
              route: 'fitness',
              isRunning: workoutMinsToday > 0,
              metric: `${workoutMinsToday}m`,
              subText: 'LOGGED TODAY',
            },
            {
              id: 'finance',
              title: 'Finance',
              Vector: FinanceVector,
              route: 'finance',
              isRunning: false,
              metric: totalPhysical > 0 ? `${Math.round(totalPhysical).toLocaleString()}` : '—',
              subText: 'TOTAL BALANCE',
            },
          ] as const).map((card) => {
            const isActive = activeCardId === card.id;
            const { Vector } = card;
            const isHovered = hoveredCardId === card.id;
            const isReceded = !!hoveredCardId && !isHovered && !isActive;
            return (
              <div
                key={card.id}
                onClick={() => {
                  setActiveCardId(card.id as any);
                  setLastManualClickTime(Date.now());
                }}
                onDoubleClick={() => navigate(card.route)}
                onMouseEnter={() => setHoveredCardId(card.id)}
                onMouseLeave={() => setHoveredCardId(null)}
                className={`cursor-pointer transform-gpu relative select-none flex flex-col justify-between p-4 border ${
                  isActive
                    ? 'border-ink text-ink opacity-100'
                    : 'border-dashed border-ink/30 bg-paper/60 text-ink opacity-65 hover:opacity-100 hover:border-ink/60'
                } w-[160px] lg:w-[230px] h-[100px] lg:h-[110px] shrink-0`}
                style={{
                  ...(isActive ? { backgroundColor: 'var(--paper-dark)' } : {}),
                  transform: isReceded ? 'scale(0.97)' : 'scale(1)',
                  opacity: isReceded ? 0.35 : undefined,
                  filter: isReceded ? 'blur(0.6px)' : 'none',
                  transition: 'transform 500ms cubic-bezier(0.23, 1, 0.32, 1), opacity 500ms cubic-bezier(0.23, 1, 0.32, 1), filter 500ms cubic-bezier(0.23, 1, 0.32, 1), border-color 200ms ease',
                }}
              >
                {/* Spinning vector shown left of card when system-auto-selected */}
                {systemCardId === card.id && (
                  <div className="hidden lg:block absolute -left-10 top-1/2 -translate-y-1/2 z-10">
                    <SidebarActiveVector />
                  </div>
                )}


                <div className="flex justify-between items-start pointer-events-none">
                  <span className="font-sans-main text-xs font-black tracking-tight uppercase truncate mr-2">
                    {card.title}
                  </span>
                  {Vector && (
                    <div
                      className="shrink-0 text-ink"
                      style={{
                        opacity: isActive || hoveredCardId === card.id ? 1 : 0,
                        transition: 'opacity 0.6s ease',
                      }}
                    >
                      <Vector
                        {...(card.id === 'water' ? { fillLevel: waterFillLevel } : {})}
                        {...(card.id === 'pomodoro' ? { paused: focusPaused } : {})}
                        {...(card.id === 'fitness' ? { paused: fitnessPaused } : {})}
                        {...(card.id === 'prayer' ? { paused: prayerPaused } : {})}
                      />
                    </div>
                  )}
                </div>
                <div className="mt-1 pointer-events-none">
                  <span className="font-mono-main text-[16px] lg:text-[18px] font-black block truncate">
                    {card.id === 'finance' && totalPhysical > 0
                      ? <MaskedValue>{card.metric}</MaskedValue>
                      : card.metric}
                  </span>
                  <span className={`font-mono-main text-[8px] lg:text-[9px] tracking-wider font-bold uppercase block truncate ${
                    isActive ? 'text-ink/50' : 'text-ink/40'
                  }`}>
                    {card.subText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Stage (Center/Right) */}
        <div className="flex-1 flex flex-col items-stretch min-h-[280px] lg:min-h-0 lg:h-[740px]">
          <div
            onClick={() => {
              const found = [
                { id: 'pomodoro', route: 'pomodoro' },
                { id: 'water', route: 'water' },
                { id: 'fitness', route: 'fitness' },
                { id: 'prayer', route: 'prayer' },
                { id: 'calendar', route: 'calendar' },
                { id: 'finance', route: 'finance' },
              ].find(c => c.id === activeCardId);
              if (found) navigate(found.route);
            }}
            className="flex-1 flex flex-col justify-between brutalist-card bg-paper p-5 sm:p-8 lg:p-10 relative group cursor-pointer"
          >
              {/* Active Card Body Renderer */}
              <div className="flex-1 flex flex-col" style={{ opacity: bigCardVisible ? 1 : 0, transition: 'opacity 0.2s ease' }}>
              {displayedCardId === 'water' && (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1" >{`WATER`}</h2>
                    </div>
                    <div className="text-ink opacity-60">
                      <WaterVector size={36} fillLevel={waterFillLevel} />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 mt-6">
                    <div className="flex items-end gap-4">
                      <DotMatrixText 
                        text={String(glasses)} 
                        dotSizeClassName="w-[12px] h-[12px] sm:w-[15px] sm:h-[15px]" 
                        gapClassName="gap-[4px] sm:gap-[5px]" 
                      />
                      <span className="font-mono-main text-3xl sm:text-4xl font-bold text-ink/40 leading-none">
                        / 14
                      </span>
                      <span className="font-sans-main text-sm font-bold uppercase tracking-wider text-ink/60 ml-2 leading-none">glasses today</span>
                    </div>

                    <button 
                      onClick={addWaterCup}
                      className="btn-brutalist flex items-center gap-2 font-mono-main py-3 px-6 text-sm"
                    >
                      <Plus size={18} strokeWidth={3} />
                      Add Glass
                    </button>
                  </div>
                </div>
              )}

              {displayedCardId === 'pomodoro' && (
                <div className="flex-1 flex flex-col justify-between">
                  {(pomodoroRunning || pomodoroOvertime) ? (
                    <>
                      {/* Top — status strip, mirrors idle header */}
                      <div className="flex justify-between items-start">
                        <span className="font-mono-main text-[10px] font-bold tracking-[0.25em] uppercase"
                          style={{ color: pomodoroOvertime ? 'var(--pomo-overtime)' : mode === 'break' ? 'var(--pomo-break)' : 'var(--pomo-focus)' }}>
                          {pomodoroOvertime ? '● OVERTIME' : `● ${mode.toUpperCase()}`}
                        </span>
                      </div>

                      {/* Middle — dot-matrix countdown */}
                      {(() => {
                        const secs = pomodoroOvertime ? overtime : timeLeft;
                        const totalMins = Math.floor(secs / 60);
                        const mm = totalMins >= 100 ? String(totalMins) : String(totalMins).padStart(2, '0');
                        const ss = String(secs % 60).padStart(2, '0');
                        const col = pomodoroOvertime ? 'var(--pomo-overtime)' : mode === 'break' ? 'var(--pomo-break)' : 'var(--pomo-focus)';
                        return (
                          <div className="flex-1 flex items-center justify-center w-full">
                            <DMTimer mm={mm} ss={ss} color={col} maxWidth="min(100%, 340px)" />
                          </div>
                        );
                      })()}

                      {/* Bottom — wavy dot-matrix progress bar */}
                      <WavyProgressBar
                        pct={pomodoroOvertime ? 100 : Math.max(0, (((mode === 'focus' ? focusDuration : breakDuration) * 60 - timeLeft) / ((mode === 'focus' ? focusDuration : breakDuration) * 60)) * 100)}
                        isOvertime={pomodoroOvertime}
                        mode={mode}
                        running={pomodoroRunning}
                        totalSecs={(mode === 'focus' ? focusDuration : breakDuration) * 60}
                      />
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-start">
                        <div>
                              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1" >{`YOUR FOCUS`}</h2>
                        </div>
                        <div className="text-ink opacity-60">
                          <FocusVector size={36} paused={focusPaused} />
                        </div>
                      </div>

                      <div className="flex items-end justify-between gap-4">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono-main text-5xl sm:text-7xl lg:text-8xl font-black text-ink leading-none">
                            {focusMinutes > 0 ? focusHours : '0'}
                          </span>
                          <span className="font-mono-main text-3xl font-bold text-ink/40">h</span>
                          <span className="font-sans-main text-xs font-bold uppercase tracking-wider text-ink/60 ml-1">focused today</span>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); pomodoroStart(); }}
                          className="btn-brutalist shrink-0 flex items-center gap-2 px-5 py-3 text-sm"
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                            <polygon points="2,1 9,5 2,9" />
                          </svg>
                          START FOCUS
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {displayedCardId === 'fitness' && (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1" >{`TRAINING`}</h2>
                    </div>
                    <div className="text-ink">
                      <FitnessVector size={36} paused={fitnessPaused} />
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="font-mono-main text-5xl sm:text-7xl lg:text-8xl font-black text-ink leading-none">
                      {workoutMinsToday}
                    </span>
                    <span className="font-mono-main text-3xl font-bold text-ink/40">m</span>
                    <span className="font-sans-main text-xs font-bold uppercase tracking-wider text-ink/60 ml-1">logged today</span>
                  </div>
                </div>
              )}

              {displayedCardId === 'prayer' && (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1" >{`DEVOTION`}</h2>
                    </div>
                    <div className="text-ink">
                      <PrayerVector size={36} paused={prayerPaused} />
                    </div>
                  </div>

                  <span className="font-sans-main text-4xl sm:text-5xl lg:text-6xl font-black text-ink uppercase tracking-tight">
                    {cardPrayer.name}
                  </span>
                </div>
              )}

              {displayedCardId === 'calendar' && (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1" >{`CALENDAR`}</h2>
                    </div>
                    <div className="text-ink">
                      <CalendarVector size={36} />
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="font-mono-main text-5xl sm:text-7xl lg:text-8xl font-black text-ink leading-none">
                      {now.getDate()}
                    </span>
                    <span className="font-sans-main text-3xl font-bold text-ink/50 uppercase tracking-widest">
                      {now.toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  </div>
                </div>
              )}

              {displayedCardId === 'finance' && (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1" >{`FINANCE`}</h2>
                    </div>
                    <div className="text-ink opacity-60">
                      <FinanceVector size={36} />
                    </div>
                  </div>

                  <div className="flex items-end gap-4">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono-main text-4xl sm:text-5xl lg:text-6xl font-black text-ink leading-none">
                        {totalPhysical > 0
                          ? <MaskedValue>{Math.round(totalPhysical).toLocaleString()}</MaskedValue>
                          : '—'}
                      </span>
                      {totalPhysical > 0 && (
                        <span className="font-mono-main text-2xl font-bold text-ink/40">EGP</span>
                      )}
                    </div>
                    {pendingItems.length > 0 && (
                      <span className="font-mono-main text-[10px] font-bold tracking-[0.2em] text-ink/40 uppercase mb-1">
                        {pendingItems.length} PENDING
                      </span>
                    )}
                  </div>
                </div>
              )}
              </div>
          </div>
        </div>

      </main>

      {/* 3. RETRO CLOCK */}
      <footer className="w-full max-w-[1400px] mx-auto mt-4 flex flex-col items-center text-center">
        {/* BOTTOM METADATA & CLOCK */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-mono-main text-[10px] sm:text-[11px] font-bold opacity-30 tracking-[0.3em] uppercase leading-none mb-1">{dateStringEn}</span>
          <p className="font-mono-main text-3xl sm:text-4xl text-ink font-black tracking-widest leading-none">
            {timeOnly} <span className="text-[11px] font-sans opacity-70 ml-1 font-bold">{amPm}</span>
          </p>
        </div>
      </footer>

      <AppModal
        isOpen={errorModal}
        onClose={() => setErrorModal(false)}
        title="Upload failed"
        confirm={{ message: 'Something went wrong while uploading your avatar. Please try again.', confirmText: 'Got it', cancelText: 'Dismiss', onConfirm: () => setErrorModal(false) }}
      />
      <AppModal
        isOpen={logoutModal}
        onClose={() => setLogoutModal(false)}
        title="Timer is running"
        confirm={{ message: 'You have an active Pomodoro session. Logging out will stop your timer and unsaved progress will be lost.', confirmText: 'Log out', cancelText: 'Stay', onConfirm: () => { setLogoutModal(false); signOut(auth); } }}
      />

      {/* MONTHLY FINGERPRINT MODAL */}
      {(() => {
        const year = now.getFullYear();
        const currentMonth = now.getMonth();
        const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        return (
      <AppModal isOpen={showFingerprint} onClose={() => setShowFingerprint(false)} maxWidth="max-w-2xl"
        title={<div>
          <div className="font-mono-main text-[10px] tracking-[0.25em] uppercase mb-1" style={{ color: 'color-mix(in srgb, var(--ink) 30%, transparent)' }}>ANNUAL FINGERPRINT</div>
          <div className="font-sans-main text-2xl font-light tracking-tight" style={{ color: 'color-mix(in srgb, var(--ink) 70%, transparent)' }}>{year}</div>
        </div>}
      >
              <div className="grid grid-cols-4 gap-3">
                {MONTH_NAMES.map((name, i) => {
                  const mk = `${year}-${String(i + 1).padStart(2, '0')}`;
                  const monthDays = Object.fromEntries(
                    Object.entries(dailyHistory).filter(([k]) => k.startsWith(mk))
                  );
                  const isFuture = i > currentMonth;
                  const hasData = Object.keys(monthDays).length > 0;
                  return (
                    <motion.div
                      key={mk}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                      className="flex flex-col items-center gap-2 p-3"
                      style={{
                        background: hasData ? 'color-mix(in srgb, var(--ink) 5%, transparent)' : 'transparent',
                        border: `1px solid color-mix(in srgb, var(--ink) ${hasData ? 10 : 5}%, transparent)`,
                        opacity: isFuture ? 0.25 : 1,
                      }}
                    >
                      {hasData ? (
                        <MonthFingerprint monthKey={mk} days={monthDays} size={72} />
                      ) : (
                        <div style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div className="w-1 h-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--ink) 15%, transparent)' }} />
                        </div>
                      )}
                      <div className="font-mono-main text-[9px] tracking-[0.2em]" style={{ color: `color-mix(in srgb, var(--ink) ${hasData ? 40 : 20}%, transparent)` }}>{name}</div>
                      {hasData && (
                        <div className="font-mono-main text-[8px]" style={{ color: 'color-mix(in srgb, var(--ink) 25%, transparent)' }}>{Object.keys(monthDays).length}d</div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
      </AppModal>
        );
      })()}

    </div>
  );
};
