import React, { useState, useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';
import { HugeiconsIcon } from '@hugeicons/react';
import { LockIcon, Login03Icon } from '@hugeicons/core-free-icons';

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark-theme'));

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.body.classList.add('dark-theme');
      setIsDark(true);
    } else {
      document.body.classList.remove('dark-theme');
      setIsDark(false);
    }
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    document.body.classList.toggle('dark-theme', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const whitelistedEmail = 'hamed.rakeeen@gmail.com';
      const userEmail = user.email?.toLowerCase();

      if (userEmail !== whitelistedEmail) {
        await auth.signOut();
        setError(`Unauthorized access: ${user.email} is not in the whitelist.`);
      }
    } catch (err: any) {
      console.error(err);
      setError('Login failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-300" style={{ background: 'var(--paper)' }}>
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-5 right-5 z-20 cursor-pointer"
        title={isDark ? 'Switch to light' : 'Switch to dark'}
      >
        {isDark ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink/40 hover:text-ink transition-colors">
            <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink/40 hover:text-ink transition-colors">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
      </button>
      
      <div className="w-full max-w-md brutalist-card no-lift p-10 md:p-12 relative z-10 text-center">
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 bg-sepia/20 flex items-center justify-center border border-ink text-ink" style={{ borderRadius: 0 }}>
            <HugeiconsIcon icon={LockIcon} size={28} strokeWidth={1.5} />
          </div>
        </div>
        
        <div className="mb-10">
          <h1 className="text-3xl font-black uppercase tracking-tight">Vault gatekeeper</h1>
        </div>

        {error && (
          <div className="bg-rust/10 border-2 border-rust text-rust text-[11px] font-black px-4 py-3 mb-8" style={{ borderRadius: 0 }}>
             {error}
          </div>
        )}

        <button 
          onClick={handleGoogleLogin} 
          disabled={loading}
          className="btn-brutalist w-full flex items-center justify-center gap-3 py-4 text-base font-mono-main"
        >
          {loading ? (
             <div className="w-5 h-5 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />
          ) : (
            <>
              <HugeiconsIcon icon={Login03Icon} size={20} strokeWidth={1.5} />
              <span>CONTINUE WITH GOOGLE</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
