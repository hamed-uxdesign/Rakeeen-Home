import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { uploadImage } from '../../utils/cloudinary';
import { Droplet, Calendar as CalIcon, Timer, Moon, Sun, Activity, ChevronRight, Plus, Clock, Camera, MoreVertical, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { Label } from '../ui/UIComponents';
import { usePomodoro } from '../../hooks/usePomodoro';
import { CustomModal } from '../ui/CustomModal';
import { WavyRing } from './Pomodoro';
import { getLogicalDate } from '../../utils/timeHelpers';

interface HomeProps {
  navigate: (to: string) => void;
}

export const Home: React.FC<HomeProps> = ({ navigate }) => {
  const [avatarUrl, setAvatarUrl] = useFirebaseSync<string | null>('avatar_url', null);
  const [glasses, setGlasses] = useFirebaseSync<number>('hydration_glasses', 0);
  const [workouts] = useFirebaseSync<any[]>('fitness_workouts', []);
  
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
  
  // Format English Date
  const dateStringEn = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  
  // Format Arabic Date for Thmanyah display fallback
  const dateStringAr = now.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });

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

      {/* 2. MAIN EXPANSIVE GRID SECTION */}
      <main className="w-full max-w-[1400px] mx-auto flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16 items-stretch">
        
        {/* HERO CARD 1: WATER (Spans 2 columns on Large screens) */}
        <div 
          onClick={() => navigate('water')}
          className="brutalist-dashed-card lg:col-span-2 cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-black tracking-tight">WATER INTAKE</h2>
            </div>
            <div className="w-12 h-12 bg-sepia/20 flex items-center justify-center border border-ink text-ink group-hover:scale-110 transition-transform" style={{ borderRadius: 0 }}>
              <Droplet size={22} className="fill-current" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 mt-4">
            <div className="flex items-baseline gap-2">
              <span className="font-mono-main text-7xl sm:text-8xl font-black tracking-tighter text-ink leading-none">
                {glasses}
              </span>
              <span className="font-mono-main text-2xl sm:text-3xl font-bold text-ink/40">
                / 14
              </span>
              <span className="font-sans-main text-sm font-bold uppercase tracking-wider text-ink/60 ml-2">glasses today</span>
            </div>

            <button 
              onClick={addWaterCup}
              className="btn-brutalist flex items-center gap-2 font-mono-main"
            >
              <Plus size={16} strokeWidth={3} />
              Add Glass
            </button>
          </div>
        </div>

        {/* CARD 2: FOCUS TIMER (POMODORO) */}
        <div 
          onClick={() => navigate('pomodoro')}
          className="brutalist-card cursor-pointer flex flex-col justify-between group overflow-hidden relative"
          style={{ padding: (pomodoroRunning || pomodoroOvertime) ? '0' : '2rem' }}
        >
          {(pomodoroRunning || pomodoroOvertime) ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-paper-dark">
              {/* Embedded Wavy Timer Ring taking full card bounds */}
              <div className="relative w-full aspect-square max-w-[240px] flex items-center justify-center">
                <div className={`absolute inset-6 rounded-full blur-[48px] opacity-20 transition-colors duration-1000 ${pomodoroOvertime ? 'bg-rust' : (mode === 'break' ? 'bg-sepia' : 'bg-forest')}`} />
                <WavyRing 
                  pct={pomodoroOvertime ? 100 : Math.max(0, (((mode === 'focus' ? focusDuration : breakDuration) * 60 - timeLeft) / ((mode === 'focus' ? focusDuration : breakDuration) * 60)) * 100)} 
                  phase={phase} 
                  mode={mode} 
                  isOvertime={pomodoroOvertime} 
                  size={240} 
                  waves={mode === 'break' ? breakDuration || 5 : focusDuration || 25} 
                />
                
                {/* Giant countdown timer value in center */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className={`text-3xl sm:text-4xl font-black tracking-tight mb-1 tabular-nums leading-none ${pomodoroOvertime ? 'text-rust' : 'text-ink'}`}>
                    {pomodoroOvertime ? `+${Math.floor(overtime / 60)}m` : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
                  </span>
                  <span className="text-[9px] tracking-[0.25em] font-bold text-ink/30 uppercase">
                    {pomodoroOvertime ? 'OVERTIME' : mode}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-black tracking-tight">FOCUS TIME</h2>
                </div>
                <div className="w-12 h-12 bg-sepia/20 flex items-center justify-center border border-ink text-ink group-hover:scale-110 transition-transform" style={{ borderRadius: 0 }}>
                  <Timer size={22} />
                </div>
              </div>

              <div className="flex items-baseline gap-2 my-4">
                <span className="font-mono-main text-6xl sm:text-7xl font-black text-ink leading-none">
                  {focusMinutes > 0 ? focusHours : '0'}
                </span>
                <span className="font-mono-main text-2xl font-bold text-ink/40">h</span>
                <span className="font-sans-main text-xs font-bold uppercase tracking-wider text-ink/60 ml-1">focused today</span>
              </div>

              <div className="flex items-center justify-between border-t border-ink/5 pt-4">
                <span className="font-mono-main text-xs font-bold uppercase tracking-widest text-ink/50 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${pomodoroRunning ? 'bg-green-500 animate-pulse' : 'bg-ink/20'}`}></span>
                  {pomodoroRunning ? 'TIMER RUNNING' : 'STATUS: IDLE'}
                </span>
                <ChevronRight size={18} className="text-ink/40 group-hover:translate-x-1 transition-transform" />
              </div>
            </>
          )}
        </div>

        {/* CARD 3: FITNESS */}
        <div 
          onClick={() => navigate('fitness')}
          className="brutalist-card cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-black tracking-tight">TRAINING</h2>
            </div>
            <div className="w-12 h-12 bg-sepia/20 flex items-center justify-center border border-ink text-ink group-hover:scale-110 transition-transform" style={{ borderRadius: 0 }}>
              <Activity size={22} />
            </div>
          </div>

          <div className="flex items-baseline gap-2 my-4">
            <span className="font-mono-main text-6xl sm:text-7xl font-black text-ink leading-none">
              {workoutMinsToday}
            </span>
            <span className="font-mono-main text-2xl font-bold text-ink/40">m</span>
            <span className="font-sans-main text-xs font-bold uppercase tracking-wider text-ink/60 ml-1">logged today</span>
          </div>

          <div className="flex items-center justify-between border-t border-ink/5 pt-4">
            <span className="font-mono-main text-xs font-bold uppercase tracking-widest text-ink/50">
              KEEP IT GOING
            </span>
            <ChevronRight size={18} className="text-ink/40 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* CARD 4: PRAYER TIMES */}
        <div 
          onClick={() => navigate('prayer')}
          className="brutalist-card cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-black tracking-tight">PRAYER</h2>
            </div>
            <div className="w-12 h-12 bg-sepia/20 flex items-center justify-center border border-ink text-ink group-hover:scale-110 transition-transform" style={{ borderRadius: 0 }}>
              <Moon size={22} />
            </div>
          </div>

          <div className="my-4">
            <span className="font-sans-main text-4xl sm:text-5xl font-black text-ink uppercase tracking-tight">ASR</span>
          </div>

          <div className="flex items-center justify-between border-t border-ink/5 pt-4">
            <span className="font-mono-main text-xs font-bold uppercase tracking-widest text-ink/50">
              ATHAN AT 3:45 PM
            </span>
            <ChevronRight size={18} className="text-ink/40 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* CARD 5: CALENDAR */}
        <div 
          onClick={() => navigate('calendar')}
          className="brutalist-card cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-black tracking-tight">CALENDAR</h2>
            </div>
            <div className="w-12 h-12 bg-sepia/20 flex items-center justify-center border border-ink text-ink group-hover:scale-110 transition-transform" style={{ borderRadius: 0 }}>
              <CalIcon size={22} />
            </div>
          </div>

          <div className="flex items-baseline gap-2 my-4">
            <span className="font-mono-main text-6xl sm:text-7xl font-black text-ink leading-none">
              {now.getDate()}
            </span>
            <span className="font-sans-main text-xl font-bold text-ink/50 uppercase tracking-widest">
              {now.toLocaleDateString('en-US', { month: 'short' })}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-ink/5 pt-4">
            <span className="font-mono-main text-xs font-bold uppercase tracking-widest text-ink/50">
              {now.toLocaleDateString('en-US', { weekday: 'long' })}
            </span>
            <ChevronRight size={18} className="text-ink/40 group-hover:translate-x-1 transition-transform" />
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
