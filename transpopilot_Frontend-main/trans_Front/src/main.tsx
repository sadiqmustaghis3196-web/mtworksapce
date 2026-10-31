import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { createApiInterceptor } from './api/monitoring';
import 'leaflet/dist/leaflet.css';

// Initialize API monitoring interceptor
// This is safe to fail - auth will work even if monitoring doesn't
// Set VITE_DISABLE_API_MONITORING=true to completely disable monitoring
try {
  // Delay interceptor initialization slightly to ensure Supabase client is ready
  setTimeout(() => {
    try {
      createApiInterceptor();
    } catch (error) {
      console.warn('API monitoring disabled due to initialization error:', error);
    }
  }, 100);
} catch (error) {
  console.warn('API monitoring initialization skipped:', error);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
