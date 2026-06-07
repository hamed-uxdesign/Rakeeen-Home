import React from 'react';
import { useLocation } from 'react-router-dom';
import { usePomodoro } from '../../hooks/usePomodoro';
import { formatTime } from '../../utils/timeHelpers';
import { WavyRing } from '../dashboard/Pomodoro';
import { motion } from 'framer-motion';

interface FloatingTimerProps {
  onNavigate: () => void;
  currentPage: string;
}

export const FloatingTimer: React.FC<FloatingTimerProps> = ({ onNavigate }) => {
  const { running, isOvertime, mode, timeLeft, overtime, focusDuration, breakDuration } = usePomodoro();
  const location = useLocation();

  // ── All hooks MUST be called before any early returns (Rules of Hooks) ──
  const [phase, setPhase] = React.useState(0);

  React.useEffect(() => {
    let animId: number;
    const animate = () => {
      setPhase(p => (p + 0.05) % (Math.PI * 2));
      animId = requestAnimationFrame(animate);
    };
    if (running || isOvertime) animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [running, isOvertime]);

  // Derived values (safe to compute before early return)
  const isOnPomodoro = location.pathname.includes('pomodoro');
  const displayTime = isOvertime ? `+${formatTime(overtime)}` : formatTime(timeLeft);
  const color = isOvertime ? 'text-rust' : (mode === 'focus' ? 'text-forest' : 'text-sepia');
  const total = mode === 'focus' ? focusDuration * 60 : breakDuration * 60;
  const pct = isOvertime ? 100 : Math.max(0, ((total - timeLeft) / total) * 100);
  const waves = mode === 'focus' ? focusDuration : breakDuration;

  const isOnHome = location.pathname === '/' || location.pathname === '' || location.pathname.endsWith('Rakeeen-Home') || location.pathname.endsWith('Rakeeen-Home/');
  
  // Don't render if timer not active or already on pomodoro page
  if ((!running && !isOvertime) || isOnPomodoro) return null;

  // If we are on the Home page, we also hide the bottom corner floating widget (as requested: "وتتحط شكل الدايره بتاعة البومدورو [جوة كارت الهوم] وبالتالي تتشال من الجمب من تحت [أثناء وجودنا في الهوم]")
  if (isOnHome) return null;

  return (
    <button
      onClick={onNavigate}
      className="fixed bottom-8 right-8 z-50 flex items-center justify-center transition-transform duration-300 hover:scale-105 hover:-translate-y-1 outline-none group"
      title="Return to Pomodoro"
    >
      <div className="relative flex items-center justify-center">
        {/* Glow effect behind the ring */}
        <div className={`absolute inset-4 rounded-full blur-[20px] opacity-20 transition-colors duration-1000 ${isOvertime ? 'bg-rust' : (mode === 'focus' ? 'bg-forest' : 'bg-sepia')}`} />
        
        <WavyRing pct={pct} phase={phase} mode={mode} isOvertime={isOvertime} size={140} waves={waves} />
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <motion.span
            className={`text-2xl font-black transition-colors duration-500 tabular-nums leading-none ${color}`}
            animate={{ scale: 1 }}
          >
            {displayTime}
          </motion.span>
        </div>
      </div>
    </button>
  );
};
