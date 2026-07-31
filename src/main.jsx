import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
      const announceUpdate = worker => {
        if (worker?.state === 'installed' && navigator.serviceWorker.controller) {
          window.dispatchEvent(new Event('pwa-update-ready'));
        }
      };
      if (registration.waiting) announceUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', event => announceUpdate(event.target));
      });
    }).catch(error => {
      console.warn('Offline app shell could not be registered:', error);
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
