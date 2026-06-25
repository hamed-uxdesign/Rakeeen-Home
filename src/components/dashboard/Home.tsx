import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { uploadImage } from '../../utils/cloudinary';
import { Droplet, Calendar as CalIcon, Timer, Moon, Sun, Activity, Plus, Camera, MoreVertical, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { usePomodoro } from '../../hooks/usePomodoro';
import { CustomModal } from '../ui/CustomModal';
import { WavyRing } from './Pomodoro';
import { getLogicalDate } from '../../utils/timeHelpers';
import { usePrayer } from '../../hooks/usePrayer';
import { DotMatrixText } from '../ui/DotMatrixText';
// FINANCE MODULE — disabled
// import { useFinance } from '../../hooks/useFinance';

interface HomeProps {
  navigate: (to: string) => void;
}

// Spinning dot-matrix vector shown on system-auto-activated cards
const SidebarActiveVector: React.FC = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="text-ink/60">
    <circle cx="12" cy="4" r="1.3" />
    <circle cx="17.66" cy="6.34" r="1.3" />
    <circle cx="20" cy="12" r="1.3" />
    <circle cx="17.66" cy="17.66" r="1.3" />
    <circle cx="12" cy="20" r="1.3" />
    <circle cx="6.34" cy="17.66" r="1.3" />
    <circle cx="4" cy="12" r="1.3" />
    <circle cx="6.34" cy="6.34" r="1.3" />
    <circle cx="12" cy="12" r="1.5" />
  </svg>
);

export const Home: React.FC<HomeProps> = ({ navigate }) => {
  const [activeCardId, setActiveCardId] = useState<'water' | 'pomodoro' | 'fitness' | 'prayer' | 'calendar'>('water');
  const [isSystemActive, setIsSystemActive] = useState(false);
  const [lastManualClickTime, setLastManualClickTime] = useState<number>(0);
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
    breakDuration 
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
  const [phase, setPhase] = useState(0);

  // Animate WavyRing phase when timer is running on home dashboard
  useEffect(() => {
    let animId: number;
    const animate = () => {
      setPhase(p => (p + 0.05) % (Math.PI * 2));
      animId = requestAnimationFrame(animate);
    };
    if (pomodoroRunning || pomodoroOvertime) {
      animId = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animId);
  }, [pomodoroRunning, pomodoroOvertime]);

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
    // Override auto-priority for 3 minutes (180,000 ms) after manual selection
    if (Date.now() - lastManualClickTime < 180000) {
      return;
    }

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

    let targetCardId: 'water' | 'pomodoro' | 'fitness' | 'prayer' | 'calendar' = 'water';

    if (pomodoroRunning || pomodoroOvertime) {
      targetCardId = 'pomodoro';
    } else if (isPrayerActiveOrClose) {
      targetCardId = 'prayer';
    }

    if (activeCardId !== targetCardId) {
      setActiveCardId(targetCardId);
      setIsSystemActive(true);
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
              icon: Droplet,
              route: 'water',
              metric: `${glasses} / 14`,
              subText: 'GLASSES TODAY',
            },
            {
              id: 'pomodoro',
              title: 'Focus Time',
              icon: Timer,
              route: 'pomodoro',
              metric: pomodoroRunning || pomodoroOvertime 
                ? (pomodoroOvertime ? `+${Math.floor(overtime / 60)}m` : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`)
                : `${focusMinutes > 0 ? focusHours : '0'}h`,
              subText: pomodoroRunning || pomodoroOvertime ? (pomodoroOvertime ? 'OVERTIME' : mode.toUpperCase()) : 'FOCUSED TODAY',
            },
            {
              id: 'calendar',
              title: 'Calendar',
              icon: CalIcon,
              route: 'calendar',
              metric: `${now.getDate()} ${now.toLocaleDateString('en-US', { month: 'short' })}`,
              subText: now.toLocaleDateString('en-US', { weekday: 'long' }),
            },
            {
              id: 'prayer',
              title: 'Prayer',
              icon: Moon,
              route: 'prayer',
              metric: cardPrayer.name,
              subText: cardPrayer.info,
            },
            {
              id: 'fitness',
              title: 'Training',
              icon: Activity,
              route: 'fitness',
              metric: `${workoutMinsToday}m`,
              subText: 'LOGGED TODAY',
            }
          ] as const).map(card => {
            const isActive = activeCardId === card.id;
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => {
                  setActiveCardId(card.id as any);
                  setLastManualClickTime(Date.now());
                  setIsSystemActive(false);
                }}
                onDoubleClick={() => navigate(card.route)}
                className={`cursor-pointer transform-gpu transition-all duration-200 relative select-none flex flex-col justify-between p-4 border ${
                  isActive 
                    ? 'border-ink text-ink opacity-100' 
                    : 'border-dashed border-ink/30 bg-paper/60 text-ink opacity-65 hover:opacity-100 hover:border-ink/60'
                } w-[160px] lg:w-[230px] h-[100px] lg:h-[110px] shrink-0`}
                style={isActive ? { backgroundColor: 'var(--paper-dark)' } : undefined}
              >
                {/* Absolutely positioned spinning vector to the left of the card on desktop */}
                {isActive && isSystemActive && (
                  <div className="hidden lg:block absolute -left-12 top-1/2 -translate-y-1/2 animate-spin z-10" style={{ animationDuration: '6s' }}>
                    <SidebarActiveVector />
                  </div>
                )}

                <div className="flex justify-between items-start pointer-events-none">
                  <span className="font-sans-main text-xs font-black tracking-tight uppercase truncate mr-2">
                    {card.title}
                  </span>
                  <div className={`p-1.5 border flex items-center justify-center shrink-0 ${
                    isActive 
                      ? 'bg-ink/10 border-ink/25 text-ink' 
                      : 'bg-sepia/10 border-ink/20 text-ink'
                  }`}>
                    <Icon size={14} className={card.id === 'water' ? 'fill-current' : ''} />
                  </div>
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
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCardId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
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
                    <div className="w-14 h-14 bg-sepia/20 flex items-center justify-center border border-ink text-ink group-hover:scale-105 transition-transform">
                      <Droplet size={28} className="fill-current" />
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
                    <div className="flex-1 flex flex-col items-center justify-center py-4">
                      <div className="relative w-full aspect-square max-w-[300px] flex items-center justify-center">
                        <div className={`absolute inset-6 rounded-full blur-[48px] opacity-25 transition-colors duration-1000 ${pomodoroOvertime ? 'bg-rust' : (mode === 'break' ? 'bg-sepia' : 'bg-forest')}`} />
                        <WavyRing 
                          pct={pomodoroOvertime ? 100 : Math.max(0, (((mode === 'focus' ? focusDuration : breakDuration) * 60 - timeLeft) / ((mode === 'focus' ? focusDuration : breakDuration) * 60)) * 100)} 
                          phase={phase} 
                          mode={mode} 
                          isOvertime={pomodoroOvertime} 
                          size={300} 
                          waves={mode === 'break' ? breakDuration || 5 : focusDuration || 25} 
                        />
                        
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className={`text-6xl font-black tracking-tight mb-2 tabular-nums leading-none ${pomodoroOvertime ? 'text-rust' : 'text-ink'}`}>
                            {pomodoroOvertime ? `+${Math.floor(overtime / 60)}m` : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
                          </span>
                          <span className="text-xs tracking-[0.25em] font-bold text-ink/30 uppercase">
                            {pomodoroOvertime ? 'OVERTIME' : mode}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono-main text-[10px] font-bold tracking-[0.25em] text-ink/40 uppercase">STAGE: ACTIVE</span>
                          <h2 className="text-4xl lg:text-5xl font-black tracking-tight mt-1">FOCUS TIME</h2>
                        </div>
                        <div className="w-14 h-14 bg-sepia/20 flex items-center justify-center border border-ink text-ink group-hover:scale-105 transition-transform">
                          <Timer size={28} />
                        </div>
                      </div>

                      <div className="flex items-baseline gap-2">
                        <span className="font-mono-main text-7xl sm:text-8xl font-black text-ink leading-none">
                          {focusMinutes > 0 ? focusHours : '0'}
                        </span>
                        <span className="font-mono-main text-3xl font-bold text-ink/40">h</span>
                        <span className="font-sans-main text-xs font-bold uppercase tracking-wider text-ink/60 ml-1">focused today</span>
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
                    <div className="w-14 h-14 bg-sepia/20 flex items-center justify-center border border-ink text-ink group-hover:scale-105 transition-transform">
                      <Activity size={28} />
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
                    <div className="w-14 h-14 bg-sepia/20 flex items-center justify-center border border-ink text-ink group-hover:scale-105 transition-transform">
                      <Moon size={28} />
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
                    <div className="w-14 h-14 bg-sepia/20 flex items-center justify-center border border-ink text-ink group-hover:scale-105 transition-transform">
                      <CalIcon size={28} />
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
            </motion.div>
          </AnimatePresence>
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
