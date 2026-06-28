import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  biometricCleared: boolean;
  setBiometricCleared: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  biometricCleared: false,
  setBiometricCleared: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricCleared, setBiometricClearedState] = useState(
    () => sessionStorage.getItem('biometric_cleared') === 'true'
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      // Reset biometric when user changes (logout / different account)
      if (!currentUser) {
        sessionStorage.removeItem('biometric_cleared');
        setBiometricClearedState(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const setBiometricCleared = (v: boolean) => {
    if (v) sessionStorage.setItem('biometric_cleared', 'true');
    else sessionStorage.removeItem('biometric_cleared');
    setBiometricClearedState(v);
  };

  return (
    <AuthContext.Provider value={{ user, loading, biometricCleared, setBiometricCleared }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
