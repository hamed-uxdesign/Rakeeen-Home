import React from 'react';
import { HashRouter, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Home } from './components/dashboard/Home';
import { Water } from './components/dashboard/Water';
import { Calendar } from './components/dashboard/Calendar';
import { Pomodoro } from './components/dashboard/Pomodoro';
import { Prayer } from './components/dashboard/Prayer';
import { Fitness } from './components/dashboard/Fitness';
import { Login } from './components/dashboard/Login';
import { CustomCursor } from './components/ui/CustomCursor';
import { FloatingTimer } from './components/ui/FloatingTimer';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { PomodoroProvider } from './hooks/usePomodoro';
import { FastingManager } from './components/logic/FastingManager';
import { CalendarResetManager } from './components/logic/CalendarResetManager';
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
  const { user, loading } = useAuth();

  const nav = (to: string) => {
    const path = to === 'home' ? '/' : `/${to}`;
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Derive current page from location
  const currentPage = location.pathname.replace('/Rakeeen-Home', '').replace('/', '') || 'home';

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

  return (
    <div className="min-h-screen overflow-x-hidden">
      <CustomCursor />
      <FastingManager />
      <CalendarResetManager />
      
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<AnimatedPage><Home navigate={nav} /></AnimatedPage>} />
          <Route path="/water" element={<AnimatedPage><Water navigate={nav} /></AnimatedPage>} />
          <Route path="/calendar" element={<AnimatedPage><Calendar navigate={nav} /></AnimatedPage>} />
          <Route path="/pomodoro" element={<AnimatedPage><Pomodoro navigate={nav} /></AnimatedPage>} />
          <Route path="/prayer" element={<AnimatedPage><Prayer navigate={nav} /></AnimatedPage>} />
          <Route path="/fitness" element={<AnimatedPage><Fitness navigate={nav} /></AnimatedPage>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
      
      <FloatingTimer currentPage={currentPage} onNavigate={() => nav('pomodoro')} />
    </div>
  );
};

const App: React.FC = () => {
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
