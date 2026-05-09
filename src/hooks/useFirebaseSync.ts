import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export function useFirebaseSync<T>(key: string, initialValue: T) {
  // 1. Initial State from LocalStorage (for speed)
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  // 2. Listen to Firestore changes (for sync across devices)
  useEffect(() => {
    const docRef = doc(db, 'dashboard', key);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data().value as T;
        const serverUpdatedAt = docSnap.data().updatedAt;
        const localUpdatedAt = window.localStorage.getItem(`${key}_updatedAt`);

        // Only apply if server data is newer or same as our last local update
        if (!localUpdatedAt || !serverUpdatedAt || new Date(serverUpdatedAt).getTime() >= new Date(localUpdatedAt).getTime()) {
          setStoredValue(data);
          window.localStorage.setItem(key, JSON.stringify(data));
          if (serverUpdatedAt) {
            window.localStorage.setItem(`${key}_updatedAt`, serverUpdatedAt);
          }
        }
      }
    }, (error) => {
      console.warn("Firestore Listen Error:", error);
    });

    return () => unsubscribe();
  }, [key]);

  // 3. Update Function (Updates both Local and Remote)
  const setValue = async (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Update local state first (Optimistic UI)
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));

      // Sync to Firestore
      const now = new Date().toISOString();
      window.localStorage.setItem(`${key}_updatedAt`, now);
      
      const docRef = doc(db, 'dashboard', key);
      await setDoc(docRef, { value: valueToStore, updatedAt: now });
    } catch (error) {
      console.error("Firestore Sync Error:", error);
    }
  };

  return [storedValue, setValue] as const;
}
