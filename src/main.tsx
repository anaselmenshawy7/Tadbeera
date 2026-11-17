import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (Capacitor.isNativePlatform()) {
    // Ensure native WebView never caches Capgo OTA bundles behind a stale PWA Service Worker.
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      })
      .catch(() => {});
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary fallbackTitle="حصلت مشكلة غير متوقعة في تشغيل تدبيرة">
    <App />
  </ErrorBoundary>
);
