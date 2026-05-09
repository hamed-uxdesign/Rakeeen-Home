import React, { useRef, useState, useEffect } from 'react';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { uploadImage } from '../../utils/cloudinary';
import { Droplet, Calendar as CalIcon, Timer, Moon, Activity, ChevronRight, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { getTodayIdx } from '../../utils/timeHelpers';
import { Button, Label } from '../ui/UIComponents';
import { usePomodoro } from '../../hooks/usePomodoro';
import { CustomModal } from '../ui/CustomModal';

interface Menu {
  id: string;
  icon: React.ReactNode;
  label: string;
}

interface HomeProps {
  navigate: (to: string) => void;
}

export const Home: React.FC<HomeProps> = ({ navigate }) => {
  const [avatarUrl, setAvatarUrl] = useFirebaseSync<string | null>('avatar_url', null);
  
  const [glasses] = useFirebaseSync<number>('hydration_glasses', 0);
  const [meals] = useFirebaseSync<Record<string, any[]>>('meals', { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] });
  const { weekStats, todayIdx } = usePomodoro();

  const [uploading, setUploading] = React.useState(false);
  const [errorModal, setErrorModal] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalCalories = Object.values(meals || {}).flat().reduce((a, i) => a + (i.kcal || 0), 0);
  const focusMinutes = weekStats?.[todayIdx]?.minutes || 0;
  const focusHours = (focusMinutes / 60).toFixed(1).replace('.0', '');
  const { running: pomodoroRunning, isOvertime: pomodoroOvertime } = usePomodoro();

  const menus: Menu[] = [
    { id:'water', icon:<Droplet size={18} />, label:'Water' },
    { id:'calendar', icon:<CalIcon size={18} />, label:'Calendar' },
    { id:'pomodoro', icon:<Timer size={18} />, label:'Pomodoro analytics' },
    { id:'prayer', icon:<Moon size={18} />, label:'Prayer times' },
    { id:'fitness', icon:<Activity size={18} />, label:'Fitness & nutrition' },
  ];

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

  const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }); // e.g. "3:45:10 PM"
  const [timeOnly, amPm] = timeString.split(' ');
  const dateString = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-10 px-5 relative overflow-hidden">
      <button 
        onClick={handleLogout}
        className="absolute top-8 right-8 text-ink/20 hover:text-rust transition-all flex items-center gap-2 group"
      >
        <span className="text-[10px] font-black tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Log out</span>
        <LogOut size={18} />
      </button>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

      {/* Profile Section */}
      <div className="mb-12 text-center group">
        <div 
          onClick={handleAvatarClick}
          className="w-24 h-24 rounded-full mx-auto mb-4 bg-paper-dark sketchy-border flex items-center justify-center relative overflow-hidden cursor-pointer group-hover:scale-105 transition-transform"
          style={{ borderRadius: '50%' }}
        >
          {uploading ? (
            <div className="text-[10px] text-sepia font-black animate-pulse tracking-widest">Syncing...</div>
          ) : avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl text-sepia">R</span>
          )}
        </div>
        <h1 className="text-3xl italic font-normal text-ink mb-1">
          Rakeeen Home
        </h1>
        <p className="text-[11px] text-ink/40 tracking-[0.05em] font-medium">
          Peace ya man
        </p>
      </div>

      {/* Summary bar - Non-interactive */}
      <div className="flex gap-8 mb-12 px-10 py-5 sys-card relative shadow-none">
        {[
          {label:'Glasses', value:`${glasses} / 8`},
          {label:'Focus time', value: focusMinutes > 0 ? `${focusHours}h` : '0h'},
        ].map((item, idx)=>(
          <div key={idx} className="text-center">
            <Label className="mb-1 text-[9px] opacity-40 font-black tracking-widest">{item.label}</Label>
            <div className="text-base font-bold text-sepia tracking-tight">{item.value}</div>
          </div>
        ))}
      </div>

      {/* Main menu */}
      <nav className="flex flex-col gap-3 w-full max-w-[340px]">
        {menus.map((m)=>(
          <button 
            key={m.id} 
            onClick={()=>navigate(m.id)}
            className="w-full py-4 px-8 flex items-center justify-start group rounded-[var(--radius-btn)] border-2 border-transparent transition-all duration-300 hover:border-[var(--ink)] hover:bg-[var(--paper)] hover:shadow-[4px_4px_0px_0px_var(--ink)] hover:-translate-y-1 hover:-translate-x-1 outline-none"
          >
            <span className="text-[var(--ink)] opacity-40 group-hover:opacity-100 transition-all">{m.icon}</span>
            <span className="text-lg ml-4 flex-1 text-left text-[var(--ink)] transition-all">{m.label}</span>
            <ChevronRight size={18} className="text-[var(--ink)] opacity-20 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
          </button>
        ))}
      </nav>

      <div className="mt-14 text-center">
        <Label className="text-[10px] opacity-30 font-black tracking-[0.3em]">{dateString}</Label>
        <p className="text-xl text-sepia mt-2 font-black tracking-wide">
          {timeOnly} <span className="text-[10px] font-sans opacity-70 ml-1">{amPm}</span>
        </p>
      </div>

      {/* Custom Modals */}
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
