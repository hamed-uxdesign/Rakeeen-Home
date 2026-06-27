import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { uploadImage } from '../../utils/cloudinary';
import { Sun, Plus, Camera, MoreVertical, LogOut, Moon } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { usePomodoro } from '../../hooks/usePomodoro';
import { CustomModal } from '../ui/CustomModal';
import { getLogicalDate } from '../../utils/timeHelpers';
import { usePrayer } from '../../hooks/usePrayer';
import { DotMatrixText } from '../ui/DotMatrixText';
// FINANCE MODULE — disabled
// import { useFinance } from '../../hooks/useFinance';

interface HomeProps {
  navigate: (to: string) => void;
}

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

// RUNNING SIGNAL — broadcasting dot arcs; center always on, rings ripple outward.

// ─── Dot-matrix digit data (5 rows × 4 cols) ──────────────────────────────
const DM: Record<string, number[][]> = {
  '0':[[1,1,1,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,1,1,1]],
  '1':[[0,0,1,0],[0,1,1,0],[0,0,1,0],[0,0,1,0],[0,1,1,1]],
  '2':[[1,1,1,1],[0,0,0,1],[1,1,1,1],[1,0,0,0],[1,1,1,1]],
  '3':[[1,1,1,1],[0,0,0,1],[0,1,1,1],[0,0,0,1],[1,1,1,1]],
  '4':[[1,0,0,1],[1,0,0,1],[1,1,1,1],[0,0,0,1],[0,0,0,1]],
  '5':[[1,1,1,1],[1,0,0,0],[1,1,1,1],[0,0,0,1],[1,1,1,1]],
  '6':[[1,1,1,1],[1,0,0,0],[1,1,1,1],[1,0,0,1],[1,1,1,1]],
  '7':[[1,1,1,1],[0,0,0,1],[0,0,1,0],[0,1,0,0],[0,1,0,0]],
  '8':[[1,1,1,1],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,1,1,1]],
  '9':[[1,1,1,1],[1,0,0,1],[1,1,1,1],[0,0,0,1],[0,0,0,1]],
};

// Wavy progress bar — same logic as WavyRing but unrolled flat.
// phase animates via RAF exactly like the Pomodoro page, progress limits the drawn path length.
const WavyProgressBar: React.FC<{ pct: number; isOvertime: boolean; mode: string }> = ({ pct, isOvertime, mode }) => {
  const [phase, setPhase] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const tick = () => { setPhase(p => (p + 0.05) % (Math.PI * 2)); rafRef.current = requestAnimationFrame(tick); };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const W = 500; const H = 36; const midY = H / 2;
  const amplitude = 9; const waves = 5; const pts = 220;

  // Build a wavy path from x=0 to x = W*(limitPct/100), animated by phase
  const genPath = (limitPct: number) => {
    const endX = W * (limitPct / 100);
    const out: string[] = [];
    for (let i = 0; i <= pts; i++) {
      const x = (i / pts) * endX;
      const y = midY + Math.sin((x / W) * waves * Math.PI * 2 + phase) * amplitude;
      out.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return out.join(' ');
  };

  const strokeColor = isOvertime ? 'var(--rust)' : mode === 'break' ? 'var(--sepia)' : 'var(--forest)';

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none" shapeRendering="geometricPrecision" overflow="visible">
      {/* Full-length dim track */}
      <path d={genPath(100)} fill="none" stroke="var(--ink)"
        strokeWidth={3} strokeOpacity={0.07} strokeLinecap="round"
        vectorEffect="non-scaling-stroke" />
      {/* Progress path — grows from left as pct increases */}
      {pct > 0 && (
        <path d={genPath(pct)} fill="none" stroke={strokeColor}
          strokeWidth={4} strokeLinecap="round"
          vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
};

// ─── Section Vectors ────────────────────────────────────────────────────────
// Style matches Calendar DotMatrixVector: dot-matrix shapes, viewBox 0 0 24 24
// Each shape + animation expresses the section concept.
// size=20 → small card   size=36 → big card corner

// WATER — teardrop outline; animation fills bottom→top like water rising inside the drop
const WaterVector: React.FC<{ size?: number }> = ({ size = 20 }) => {
  // [cx, cy, delayOrder] — order 0 = bottom (first to light), 6 = tip (last to light)
  const dots: [number, number, number][] = [
    [12,22,0],
    [9,21,1], [15,21,1],
    [7,18,2], [17,18,2],
    [5,14,3], [19,14,3],
    [7,9,4],  [17,9,4],
    [9,5,5],  [15,5,5],
    [12,2,6],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      {dots.map(([cx, cy, order], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.2"
          style={{ animation: 'vectorFade 2.5s ease-in-out infinite', animationDelay: `${order * 0.28}s` }} />
      ))}
    </svg>
  );
};

// FOCUS — hourglass; sand flows top→bottom, like time running out
const FocusVector: React.FC<{ size?: number }> = ({ size = 20 }) => {
  const dots: [number, number, number][] = [
    // top row
    [4,3,0], [8,3,0.1], [12,3,0.2], [16,3,0.1], [20,3,0],
    // mid-top (converging to waist)
    [8,8,0.55], [12,8,0.65], [16,8,0.55],
    // waist
    [12,12,1.0],
    // mid-bot (spreading from waist)
    [8,16,1.35], [12,16,1.45], [16,16,1.35],
    // bottom row
    [4,21,1.8], [8,21,1.9], [12,21,2.0], [16,21,1.9], [20,21,1.8],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      {dots.map(([cx, cy, delay], i) => (
        <circle key={i} cx={cx} cy={cy} r={i === 8 ? 1.5 : 1.2}
          style={{ animation: 'vectorFade 3s ease-in-out infinite', animationDelay: `${delay}s` }} />
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
const PrayerVector: React.FC<{ size?: number }> = ({ size = 20 }) => {
  const crescent: [number,number][] = [
    [12,2],[17,4],[20,8],[21,12],[20,16],[17,20],[12,22],[8,20],[7,16],[8,8],
  ];
  const stars: [number,number][] = [[3,6],[3,18],[4,12]];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      {crescent.map(([cx,cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.2"
          style={{ animation: 'vectorFade 2.4s ease-in-out infinite', animationDelay: `${i * 0.24}s` }} />
      ))}
      {stars.map(([cx,cy], i) => (
        <circle key={`s${i}`} cx={cx} cy={cy} r="0.9"
          style={{ animation: 'vectorFade 3s ease-in-out infinite', animationDelay: `${i * 0.9}s` }} />
      ))}
    </svg>
  );
};

// FITNESS — dumbbell/barbell; energy pulse travels left plate → bar → right plate.
// The shape is unmistakably "gym/strength". Animation = energy flowing through the lift.
const FitnessVector: React.FC<{ size?: number }> = ({ size = 20 }) => {
  // [cx, cy, delay]
  const dots: [number, number, number][] = [
    // Left weight plate (3 stacked dots)
    [3, 8,  0],
    [3, 12, 0.06],
    [3, 16, 0.12],
    // Bar (4 dots crossing mid)
    [7,  12, 0.22],
    [10, 12, 0.34],
    [14, 12, 0.46],
    [17, 12, 0.58],
    // Right weight plate (3 stacked dots)
    [21, 8,  0.68],
    [21, 12, 0.74],
    [21, 16, 0.80],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      {dots.map(([cx, cy, delay], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.3"
          style={{ animation: 'vectorFade 1.4s ease-in-out infinite', animationDelay: `${delay}s` }} />
      ))}
    </svg>
  );
};

// Single responsive SVG that renders MM:SS in dot-matrix, scales via viewBox.
// Used in both the big card (maxWidth="100%") and the fullscreen overlay.
const DMTimer: React.FC<{ mm: string; ss: string; color: string; maxWidth?: string }> = ({ mm, ss, color, maxWidth = 'min(88vw, 540px)' }) => {
  // MM: step=28, r=10  |  SS: step=17, r=6
  const mS = 28; const mR = 10;
  const sS = 17; const sR = 6;
  const mH = 4 * mS; // 112 — span between outermost dot centers
  const sH = 4 * sS; // 68
  const sOffY = (mH - sH) / 2; // 22 — vertical centering of SS relative to MM

  // x positions of each digit's first dot column
  const xMM0 = 0;
  const xMM1 = xMM0 + 3 * mS + mR * 2 + 18; // 84+20+18 = 122
  const xCol  = xMM1 + 3 * mS + mR * 2 + 10; // 122+104+10 = 236
  const colCX = xCol + mR * 1.5;              // colon center x
  const xSS0  = xCol + mR * 3 + 14;           // after colon
  const xSS1  = xSS0 + 3 * sS + sR * 2 + 14;
  const totalW = xSS1 + 3 * sS;
  const pad = mR + 4;

  const renderDigit = (digit: string, tx: number, ty: number, step: number, r: number) =>
    (DM[digit] ?? DM['0']).flatMap((row, ri) =>
      row.map((val, ci) => (
        <circle key={`${tx}-${ri}-${ci}`}
          cx={tx + ci * step} cy={ty + ri * step} r={r}
          fill={color} opacity={val ? 1 : 0.07}
          style={val ? { animation: 'dotPulse 2.4s ease-in-out infinite', animationDelay: `${(ri * 4 + ci) * 0.06}s` } : undefined} />
      ))
    );

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${totalW + pad * 2} ${mH + pad * 2}`}
      style={{ width: maxWidth, height: 'auto' }}
      overflow="visible"
    >
      {renderDigit(mm[0], xMM0, 0, mS, mR)}
      {renderDigit(mm[1], xMM1, 0, mS, mR)}
      {/* Colon — two dots */}
      <circle cx={colCX} cy={mH * 0.3} r={mR} fill={color} opacity={0.4} />
      <circle cx={colCX} cy={mH * 0.7} r={mR} fill={color} opacity={0.4} />
      {renderDigit(ss[0], xSS0, sOffY, sS, sR)}
      {renderDigit(ss[1], xSS1, sOffY, sS, sR)}
    </svg>
  );
};

export const Home: React.FC<HomeProps> = ({ navigate }) => {
  const [activeCardId, setActiveCardId] = useState<'water' | 'pomodoro' | 'fitness' | 'prayer' | 'calendar'>('water');
  const [lastManualClickTime, setLastManualClickTime] = useState<number>(0);
  // systemCardId tracks which card has system priority — independent of what user is viewing
  const [systemCardId, setSystemCardId] = useState<'water' | 'pomodoro' | 'fitness' | 'prayer' | 'calendar' | null>(null);
  const [avatarUrl, setAvatarUrl] = useFirebaseSync<string | null>('avatar_url', null);
  const [glasses, setGlasses] = useFirebaseSync<number>('hydration_glasses', 0);
  const [workouts] = useFirebaseSync<any[]>('fitness_workouts', []);
  // FINANCE MODULE — disabled
  // const [financeBanks] = useFirebaseSync<Record<string, number>>('finance_banks', {});
  // const { pendingItems } = useFinance();
  // const totalPhysical = Object.values(financeBanks).reduce((a, b) => a + (Number(b) || 0), 0);
  
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

    // Navigate the big card to the priority — but only if user hasn't manually clicked in 3 min
    if (Date.now() - lastManualClickTime < 180000) return;

    const targetCardId = priorityCardId ?? 'water';
    if (activeCardId !== targetCardId) {
      setActiveCardId(targetCardId);
    }
  }, [
    pomodoroRunning,
    pomodoroOvertime,
    cardPrayer.info,
    nextPrayer?.time,
    now,
    lastManualClickTime,
    activeCardId
  ]);

  // Quick action function to increment water glasses
  const addWaterCup = (e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering card navigation
    if (glasses < 14) {
      setGlasses(glasses + 1);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-ink py-12 px-6 md:px-12 lg:px-20 font-sans-main flex flex-col justify-between transition-colors duration-300">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

      {/* 1. HEADER SECTION */}
      <header className="w-full max-w-[1400px] mx-auto mb-16 flex flex-row items-center justify-between gap-4 border-b border-ink/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono-main text-[11px] md:text-[12px] font-bold tracking-[0.25em] text-ink/50 uppercase select-none">
              Rakeeen Home
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-sepia animate-pulse"></span>
          </div>
          <h1 className="font-sans-main text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-tight text-ink select-none">
            WELCOME BACK, <span className="font-bold" style={{ color: 'var(--ghorab-color)' }}>GHORAB</span>
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
      <main className="w-full max-w-[1400px] mx-auto flex-1 flex flex-col lg:flex-row gap-8 mb-16 items-stretch">
        
        {/* Left stack (Stage Manager dock) */}
        <div className="flex lg:flex-col gap-4 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 shrink-0 lg:w-[230px] scrollbar-none px-2 lg:px-0">
          {([
            {
              id: 'water',
              title: 'Water Intake',
              Vector: WaterVector,
              route: 'water',
              isRunning: false,
              metric: `${glasses} / 14`,
              subText: 'GLASSES TODAY',
            },
            {
              id: 'pomodoro',
              title: 'Focus Time',
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
              title: 'Prayer',
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
            }
          ] as const).map(card => {
            const isActive = activeCardId === card.id;
            const { Vector } = card;
            return (
              <div
                key={card.id}
                onClick={() => {
                  setActiveCardId(card.id as any);
                  setLastManualClickTime(Date.now());
                }}
                onDoubleClick={() => navigate(card.route)}
                className={`cursor-pointer transform-gpu transition-all duration-200 relative select-none flex flex-col justify-between p-4 border ${
                  isActive 
                    ? 'border-ink text-ink opacity-100' 
                    : 'border-dashed border-ink/30 bg-paper/60 text-ink opacity-65 hover:opacity-100 hover:border-ink/60'
                } w-[160px] lg:w-[230px] h-[100px] lg:h-[110px] shrink-0`}
                style={isActive ? { backgroundColor: 'var(--paper-dark)' } : undefined}
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
                    <div className="shrink-0 text-ink">
                      <Vector />
                    </div>
                  )}
                </div>
                <div className="mt-1 pointer-events-none">
                  <span className="font-mono-main text-[16px] lg:text-[18px] font-black block truncate">
                    {card.metric}
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
        <div className="flex-1 flex flex-col items-stretch lg:max-h-[614px]">
          <div
            onClick={() => {
              const found = [
                { id: 'pomodoro', route: 'pomodoro' },
                { id: 'water', route: 'water' },
                { id: 'fitness', route: 'fitness' },
                { id: 'prayer', route: 'prayer' },
                { id: 'calendar', route: 'calendar' }
              ].find(c => c.id === activeCardId);
              if (found) navigate(found.route);
            }}
            className="flex-1 flex flex-col justify-between brutalist-card bg-paper p-8 lg:p-10 relative group cursor-pointer"
          >

              {/* Active Card Body Renderer */}
              {activeCardId === 'water' && (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono-main text-[10px] font-bold tracking-[0.25em] text-ink/40 uppercase">STAGE: ACTIVE</span>
                      <h2 className="text-4xl lg:text-5xl font-black tracking-tight mt-1">WATER INTAKE</h2>
                    </div>
                    <div className="text-ink opacity-60">
                      <WaterVector size={36} />
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

              {activeCardId === 'pomodoro' && (
                <div className="flex-1 flex flex-col justify-between">
                  {(pomodoroRunning || pomodoroOvertime) ? (
                    <>
                      {/* Top — status strip, mirrors idle header */}
                      <div className="flex justify-between items-start">
                        <span className="font-mono-main text-[10px] font-bold tracking-[0.25em] uppercase"
                          style={{ color: pomodoroOvertime ? 'var(--rust)' : 'var(--forest)' }}>
                          {pomodoroOvertime ? '● OVERTIME' : `● ${mode.toUpperCase()}`}
                        </span>
                      </div>

                      {/* Middle — dot-matrix countdown */}
                      {(() => {
                        const secs = pomodoroOvertime ? overtime : timeLeft;
                        const mm = String(Math.floor(secs / 60)).padStart(2, '0');
                        const ss = String(secs % 60).padStart(2, '0');
                        const col = pomodoroOvertime ? 'var(--rust)' : 'var(--ink)';
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
                      />
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono-main text-[10px] font-bold tracking-[0.25em] text-ink/40 uppercase">STAGE: ACTIVE</span>
                          <h2 className="text-4xl lg:text-5xl font-black tracking-tight mt-1">FOCUS TIME</h2>
                        </div>
                        <div className="text-ink opacity-60">
                          <FocusVector size={36} />
                        </div>
                      </div>

                      <div className="flex items-end justify-between gap-4">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono-main text-7xl sm:text-8xl font-black text-ink leading-none">
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

              {activeCardId === 'fitness' && (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono-main text-[10px] font-bold tracking-[0.25em] text-ink/40 uppercase">STAGE: ACTIVE</span>
                      <h2 className="text-4xl lg:text-5xl font-black tracking-tight mt-1">TRAINING</h2>
                    </div>
                    <div className="text-ink">
                      <FitnessVector size={36} />
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="font-mono-main text-7xl sm:text-8xl font-black text-ink leading-none">
                      {workoutMinsToday}
                    </span>
                    <span className="font-mono-main text-3xl font-bold text-ink/40">m</span>
                    <span className="font-sans-main text-xs font-bold uppercase tracking-wider text-ink/60 ml-1">logged today</span>
                  </div>
                </div>
              )}

              {activeCardId === 'prayer' && (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono-main text-[10px] font-bold tracking-[0.25em] text-ink/40 uppercase">STAGE: ACTIVE</span>
                      <h2 className="text-4xl lg:text-5xl font-black tracking-tight mt-1">PRAYER</h2>
                    </div>
                    <div className="text-ink">
                      <PrayerVector size={36} />
                    </div>
                  </div>

                  <span className="font-sans-main text-5xl sm:text-6xl font-black text-ink uppercase tracking-tight">
                    {cardPrayer.name}
                  </span>
                </div>
              )}

              {activeCardId === 'calendar' && (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono-main text-[10px] font-bold tracking-[0.25em] text-ink/40 uppercase">STAGE: ACTIVE</span>
                      <h2 className="text-4xl lg:text-5xl font-black tracking-tight mt-1">CALENDAR</h2>
                    </div>
                    <div className="text-ink">
                      <CalendarVector size={36} />
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="font-mono-main text-7xl sm:text-8xl font-black text-ink leading-none">
                      {now.getDate()}
                    </span>
                    <span className="font-sans-main text-3xl font-bold text-ink/50 uppercase tracking-widest">
                      {now.toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  </div>
                </div>
              )}

              {/* FINANCE CARD — disabled */}
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

      {/* Custom Warning Modals */}
      <CustomModal
        isOpen={errorModal}
        title="Upload failed"
        message="Something went wrong while uploading your avatar. Please try again."
        confirmText="Got it"
        cancelText="Dismiss"
        onConfirm={() => setErrorModal(false)}
        onCancel={() => setErrorModal(false)}
        variant="warning"
      />
      <CustomModal
        isOpen={logoutModal}
        title="Timer is running"
        message="You have an active Pomodoro session. Logging out will stop your timer and unsaved progress will be lost."
        confirmText="Log out"
        cancelText="Stay"
        onConfirm={() => { setLogoutModal(false); signOut(auth); }}
        onCancel={() => setLogoutModal(false)}
        variant="warning"
      />

    </div>
  );
};
