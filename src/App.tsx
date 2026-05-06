import React, { useState } from 'react';
import { Home } from './components/dashboard/Home';
import { Water } from './components/dashboard/Hydration';
import { Calendar } from './components/dashboard/Calendar';
import { Pomodoro } from './components/dashboard/Pomodoro';
import { Prayer } from './components/dashboard/Prayer';
import { Fitness } from './components/dashboard/Fitness';
import { Login } from './components/dashboard/Login';
import { CustomCursor } from './components/ui/CustomCursor';
import { AuthProvider, useAuth } from './hooks/useAuth';
import './styles/global.css';

const Main: React.FC = () => {
  const [page, setPage] = useState('home');
  const { user, loading } = useAuth();

  const navigate = (to: string) => {
    setPage(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-sepia font-black tracking-[0.5em] animate-pulse">RAKEEEN</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <CustomCursor />
      {!user ? (
        <Login />
      ) : (
        <>
          {page === 'home' && <Home navigate={navigate} />}
          {page === 'hydration' && <Water navigate={navigate} />}
          {page === 'calendar' && <Calendar navigate={navigate} />}
          {page === 'pomodoro' && <Pomodoro navigate={navigate} />}
          {page === 'prayer' && <Prayer navigate={navigate} />}
          {page === 'fitness' && <Fitness navigate={navigate} />}
        </>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Main />
    </AuthProvider>
  );
};

export default App;
