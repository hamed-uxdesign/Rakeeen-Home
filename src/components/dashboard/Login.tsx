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
    <div className="min-h-screen flex items-center justify-center bg-paper p-6 relative overflow-hidden">
      {/* Background patterns */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(var(--ink) 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
      />
      
      <div className="w-full max-w-md bg-paper-dark sketchy-border p-10 md:p-12 relative z-10 text-center shadow-[8px_8px_0px_0px_rgba(232,224,208,0.1)]">
        <div className="flex justify-center mb-8">
          <div className="p-4 sketchy-border bg-white/5 border-white/20 text-sepia">
            <HugeiconsIcon icon={LockIcon} size={28} strokeWidth={1.5} />
          </div>
        </div>
        
        <div className="mb-10">
          <h1 className="text-3xl font-black tracking-tight mb-2">Vault gatekeeper</h1>
          <p className="text-[10px] text-ink/40 font-bold tracking-widest leading-relaxed">
            Secure entry restricted to <br/> <span className="text-sepia italic">hamed.rakeeen@gmail.com</span>
          </p>
        </div>

        {error && (
          <div className="bg-rust/10 border-2 border-rust/20 text-rust text-[11px] font-black px-4 py-3 mb-8 rounded-lg animate-pulse">
             {error}
          </div>
        )}

        <button 
          onClick={handleGoogleLogin} 
          disabled={loading}
          className="sketchy-btn filled w-full flex items-center justify-center gap-3 py-4 text-lg hover:scale-[1.02] active:scale-95 transition-all bg-forest border-forest text-paper"
        >
          {loading ? (
             <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <HugeiconsIcon icon={Login03Icon} size={20} strokeWidth={1.5} />
              <span className="pt-1">Continue with Google</span>
            </>
          )}
        </button>

        <p className="mt-10 text-[9px] tracking-widest text-ink/30 font-bold italic">
           Admin clearance required • AI assisted entry
        </p>
      </div>
    </div>
  );
};
