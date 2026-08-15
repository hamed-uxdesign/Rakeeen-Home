import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

// One-time Reset: Clear all old data to start fresh
if (!localStorage.getItem('is_reset_v1')) {
  localStorage.clear();
  localStorage.setItem('is_reset_v1', 'true');
}

// Global localStorage interceptor — Bommy listens to every write in the system
const _origSet = window.localStorage.setItem.bind(window.localStorage);
window.localStorage.setItem = (key: string, value: string) => {
  _origSet(key, value);
  window.dispatchEvent(new CustomEvent('bommy:change', { detail: { key, value } }));
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
