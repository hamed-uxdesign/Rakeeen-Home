import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';
import { HugeiconsIcon } from '@hugeicons/react';
import { LockIcon, Login03Icon } from '@hugeicons/core-free-icons';

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    <div className="min-h-screen flex items-center justify-center bg-bg p-6 relative overflow-hidden transition-colors duration-300">
      {/* Background patterns */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(var(--ink) 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
      />
      
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
          style={{ background: 'var(--sepia)', color: 'var(--ink)' }}
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
