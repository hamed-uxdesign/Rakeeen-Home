import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

// One-time Reset: Clear all old data to start fresh
if (!localStorage.getItem('is_reset_v1')) {
  localStorage.clear();
  localStorage.setItem('is_reset_v1', 'true');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
