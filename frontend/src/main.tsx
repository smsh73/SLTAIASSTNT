import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Service Worker 제거 및 캐시 클리어 (v2 - 2024-11-30)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
      console.log('Service Worker unregistered');
    }
  });
  
  // 캐시 스토리지 클리어
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name);
        console.log('Cache deleted:', name);
      });
    });
  }
}

console.log('=== Frontend Version: 2024-11-30-v2 ===');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

