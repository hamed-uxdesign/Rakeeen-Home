import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Home } from './components/dashboard/Home';
import { Water } from './components/dashboard/Water';
import { Calendar } from './components/dashboard/Calendar';
import { Pomodoro } from './components/dashboard/Pomodoro';
import { Prayer } from './components/dashboard/Prayer';
import { Fitness } from './components/dashboard/Fitness';
import { Finance } from './components/dashboard/Finance';
import { QuranReader } from './components/dashboard/QuranReader';
import { Login } from './components/dashboard/Login';
import { TouchIDGate } from './components/dashboard/TouchIDGate';
import { CustomCursor } from './components/ui/CustomCursor';
import { FloatingTimer } from './components/ui/FloatingTimer';
import { FloatingRadioButton } from './components/ui/FloatingRadioButton';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { PomodoroProvider } from './hooks/usePomodoro';
import { FastingManager } from './components/logic/FastingManager';
import { CalendarResetManager } from './components/logic/CalendarResetManager';
import { DeviceCodeBanner } from './components/ui/DeviceCodeBanner';
import { useSleepLock } from './hooks/useSleepLock';
import { motion, AnimatePresence } from 'framer-motion';
import './styles/global.css';

const AnimatedPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -15 }}
    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
    className="w-full"
  >
    {children}
  </motion.div>
);
const AppRoutes: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, biometricCleared, setBiometricCleared } = useAuth();
  const isSleepLocked = useSleepLock();

  const nav = (to: string) => {
    const path = to === 'home' ? '/' : `/${to}`;
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Derive current page from location
  const currentPage = location.pathname.replace('/Rakeeen-Home', '').replace('/', '') || 'home';
  // The Devotion page (Prayer Times / Radio / Quran tabs) stays fully interactive during
  // Sleep Mode — everything else in the system is locked.
  const isLockExempt = currentPage === 'devotion';

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-sepia font-black tracking-[0.5em] animate-pulse">RAKEEEN</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <CustomCursor />
        <Login />
      </div>
    );
  }

  if (!biometricCleared) {
    return (
      <div className="min-h-screen">
        <CustomCursor />
        <TouchIDGate user={user} onCleared={() => setBiometricCleared(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <CustomCursor />
      <FastingManager />
      <CalendarResetManager />

      {/* Sleep Mode (9pm-Fajr): every button in the system is disabled except on the
          Devotion page, so the actual Radio tab there stays reachable and usable. */}
      <div
        style={isSleepLocked && !isLockExempt ? { pointerEvents: 'none', userSelect: 'none', opacity: 0.55, filter: 'grayscale(0.3)' } : undefined}
        aria-hidden={isSleepLocked && !isLockExempt}
      >
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<AnimatedPage><Home navigate={nav} /></AnimatedPage>} />
            <Route path="/water" element={<AnimatedPage><Water navigate={nav} /></AnimatedPage>} />
            <Route path="/calendar" element={<AnimatedPage><Calendar navigate={nav} /></AnimatedPage>} />
            <Route path="/pomodoro" element={<AnimatedPage><Pomodoro navigate={nav} /></AnimatedPage>} />
            <Route path="/devotion" element={<AnimatedPage><Prayer navigate={nav} /></AnimatedPage>} />
            <Route path="/quran" element={<AnimatedPage><QuranReader navigate={nav} /></AnimatedPage>} />
            <Route path="/fitness" element={<AnimatedPage><Fitness navigate={nav} /></AnimatedPage>} />
            <Route path="/finance" element={<AnimatedPage><Finance navigate={nav} /></AnimatedPage>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>

        <FloatingTimer currentPage={currentPage} onNavigate={() => nav('pomodoro')} />
        <DeviceCodeBanner user={user} />
      </div>

      {isSleepLocked && !isLockExempt && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] font-mono-main text-[10px] uppercase tracking-[0.25em] font-bold px-4 py-2 border border-ink bg-[var(--paper-dark)] text-ink/50"
          style={{ pointerEvents: 'none' }}
        >
          Sleep Mode — Devotion Only
        </div>
      )}

      {/* Stays clickable even during Sleep Mode — the way back to Devotion while the
          radio plays elsewhere in the system. */}
      <FloatingRadioButton onNavigate={() => nav('devotion?tab=radio')} />
    </div>
  );
};

const App: React.FC = () => {
  // Toggles `.is-scrolling` on <html> while any scrollable element (window or a nested
  // overflow container) is actively being scrolled, then removes it after a short idle
  // pause — the scrollbar thumb CSS shows/hides based on this class.
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      document.documentElement.classList.add('is-scrolling');
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        document.documentElement.classList.remove('is-scrolling');
      }, 700);
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true } as any);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, []);

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <PomodoroProvider>
          <AppRoutes />
        </PomodoroProvider>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;
