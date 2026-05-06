import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDpyaBASLG6ZgWXQND0J4gN6OoJFGhRmb4",
  authDomain: "rakeeen-home.firebaseapp.com",
  projectId: "rakeeen-home",
  storageBucket: "rakeeen-home.firebasestorage.app",
  messagingSenderId: "725227885738",
  appId: "1:725227885738:web:0d9c7bb3bce88735202cd3",
  measurementId: "G-ED2ZQTLSP8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
