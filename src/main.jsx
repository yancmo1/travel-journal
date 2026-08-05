import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Keep the development server in control while iterating locally. A stale
// service worker can serve an older app shell and make Vite navigation errors
// look like authentication failures. Production still gets the offline PWA.
if ('serviceWorker' in navigator && import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.unregister());
  });
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
      // Check immediately, when returning to the app, and periodically while
      // it is open. The service worker activates updates without prompting.
      registration.update();
      const checkForUpdate = () => registration.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
      });
      window.setInterval(checkForUpdate, 5 * 60 * 1000);
    }).catch(error => {
      console.warn('Offline app shell could not be registered:', error);
    });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
