import React from 'react';
import { HashRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
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
import './styles/global.css';

const AppRoutes: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const nav = (to: string) => {
    const path = to === 'home' ? '/' : `/${to}`;
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Derive current page from location
  const currentPage = window.location.pathname.replace('/Rakeeen-Home', '').replace('/', '') || 'home';

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
    <div className="min-h-screen">
      <CustomCursor />
      <Routes>
        <Route path="/" element={<Home navigate={nav} />} />
        <Route path="/water" element={<Water navigate={nav} />} />
        <Route path="/calendar" element={<Calendar navigate={nav} />} />
        <Route path="/pomodoro" element={<Pomodoro navigate={nav} />} />
        <Route path="/prayer" element={<Prayer navigate={nav} />} />
        <Route path="/fitness" element={<Fitness navigate={nav} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <FloatingTimer currentPage={currentPage} onNavigate={() => nav('pomodoro')} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <PomodoroProvider>
          <AppRoutes />
        </PomodoroProvider>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;
