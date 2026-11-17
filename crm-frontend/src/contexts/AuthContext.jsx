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
      }

      setUser(null);
      return false; // Authentication failed
    } catch (err) {
      setUser(null);
      if (err.response?.status === 401) {
        setError(null);
      } else {
        console.error('Auth check error:', err.response || err);
        setError('Unable to reach the authentication server. Please try signing in again.');
      }
      return false; // Authentication failed
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authSuccess = urlParams.get('auth_success');
    const authError = urlParams.get('error');

    if (authError) {
      setUser(null);
      setError('Authentication failed. Please try signing in again.');
      setLoading(false);
      return;
    }
    
    if (authSuccess === 'true') {
      checkAuth().then((authenticated) => {
        if (authenticated) {
          navigate('/dashboard', { replace: true });
        } else {
          setError('Sign-in completed, but your session could not be verified. Please ensure cookies are enabled and try again.');
          navigate('/login', { replace: true });
        }
      });
      return;
    }
    
    if (location.pathname !== '/login') {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, [location.pathname, navigate]);

  const login = () => {
    try {
      setError(null);
      const authBaseUrl = import.meta.env.VITE_AUTH_URL || `${api.defaults.baseURL}/auth`;
      const cleanAuthUrl = authBaseUrl.trim().replace(/\/+$/, '');
      window.location.href = `${cleanAuthUrl}/google`;
    } catch (err) {
      console.error('Login redirect failed:', err);
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
