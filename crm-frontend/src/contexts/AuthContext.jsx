import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const checkAuth = async () => {
    try {
      const response = await api.get('/auth/me', { withCredentials: true });
      
      if (response.data && response.data.user) {
        setUser(response.data.user);
        setError(null);
        return true; // Authentication successful
      } else {
        setUser(null);
        return false; // Authentication failed
      }
    } catch (error) {
      setUser(null);
      if (error.response?.status !== 401) {
        console.error('Auth check error:', error.response || error);
        setError('Authentication check failed');
      }
      return false; // Authentication failed
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authSuccess = urlParams.get('auth_success');
    const uid = urlParams.get('uid');
    
    if (authSuccess === 'true') {
      console.log('Detected successful OAuth callback with user ID:', uid);
      
      // First try to check authentication
      checkAuth().then(isAuthenticated => {
        if (isAuthenticated) {
          console.log('Successfully authenticated, navigating to dashboard');
          // Clear the URL parameters
          window.history.replaceState({}, document.title, '/dashboard');
          navigate('/dashboard');
        } else {
          console.error('Authentication verification failed after OAuth callback');
          navigate('/login');
        }
      });
      return;
    }
    
    if(location.pathname !== '/login') {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, [location.pathname, navigate]);

  const login = () => {
    try {
      console.log('Initiating Google OAuth login...');
      // Ensure we're using the fully qualified Google auth URL
      const authBaseUrl = import.meta.env.VITE_AUTH_URL || `${api.defaults.baseURL}/auth`;
      
      // Remove any trailing slashes for consistency
      const cleanAuthUrl = authBaseUrl.endsWith('/') 
        ? authBaseUrl.slice(0, -1) 
        : authBaseUrl;
      
      // Target the Google auth endpoint
      window.location.href = `${cleanAuthUrl}/google`;
      
      console.log(`Redirecting to: ${cleanAuthUrl}/google`);
    } catch (error) {
      console.error('Login redirect failed:', error);
      setError('Login failed');
    }
  };

  const logout = async () => {
    try {
      console.log('Logging out...');
      await api.get('/auth/logout', { withCredentials: true });
      setUser(null);
      setError(null);
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      setError('Logout failed');
    }
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
