import React from 'react';
import { useLocation } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { usePomodoro } from '../../hooks/usePomodoro';

interface FloatingRadioButtonProps {
  onNavigate: () => void;
}

// Small floating shortcut back to the Devotion page, shown only while the Quran
// radio is playing and you've wandered off elsewhere in the system.
export const FloatingRadioButton: React.FC<FloatingRadioButtonProps> = ({ onNavigate }) => {
  const [isPlaying] = useFirebaseSync<boolean>('quran_radio_playing', false);
  const location = useLocation();
  const { running, isOvertime } = usePomodoro();

  const isOnDevotion = location.pathname.includes('devotion');
  const isOnPomodoro = location.pathname.includes('pomodoro');
  const isOnHome = location.pathname === '/' || location.pathname === '' || location.pathname.endsWith('Rakeeen-Home') || location.pathname.endsWith('Rakeeen-Home/');

  if (!isPlaying || isOnDevotion) return null;

  // The Pomodoro floating widget occupies the same bottom-right corner — stack above it
  // instead of overlapping when both are visible at once.
  const pomodoroWidgetVisible = (running || isOvertime) && !isOnPomodoro && !isOnHome;
  const bottomOffset = pomodoroWidgetVisible ? 190 : 32;

  return (
    <button
      onClick={onNavigate}
      style={{ bottom: bottomOffset }}
      className="fixed right-8 z-50 w-14 h-14 rounded-full border border-ink bg-[var(--paper-dark)] flex items-center justify-center text-ink shadow-lg hover:scale-105 transition-transform cursor-pointer"
      title="Back to Devotion — Quran Radio playing"
    >
      <Radio size={20} />
    </button>
  );
};
