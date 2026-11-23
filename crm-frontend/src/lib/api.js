import axios from 'axios';

// Determine the base URL based on environment
const getBaseUrl = () => {
  // If explicitly configured to force direct external backend calls (opt-in override)
  if (import.meta.env.VITE_FORCE_CROSS_ORIGIN === 'true' && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '');
  }

  // Same-site architecture (recommended):
  // When running on Vercel or local Vite dev server, use relative path ('')
  // so all requests go to the same origin (/api and /auth), which are proxied
  // to the backend. This guarantees 100% first-party cookies that are NEVER
  // blocked by Chrome, Safari ITP, Firefox, or Brave.
  return '';
};

// Create axios instance with default config
const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache'
  }
});

// Add a request interceptor
api.interceptors.request.use(
  (config) => {
    // Ensure credentials are always included
    config.withCredentials = true;
    
    if (import.meta.env.DEV) {
      console.log(`Making ${config.method} request to ${config.url}`);
    }
    
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(`Response from ${response.config.url}:`, response.data);
    }
    return response;
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error('Response error:', error.response || error);
    }
    
    // Only redirect to login for 401 errors if we're not already on the login page
    // and not trying to check authentication status
    if (error.response?.status === 401 && 
        !window.location.pathname.includes('login') && 
        !error.config?.url?.includes('/auth/me')) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api; 