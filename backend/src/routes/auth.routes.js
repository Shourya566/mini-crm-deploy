import express from 'express';
import passport from 'passport';
import { isAuthenticated } from '../middleware/auth.middleware.js';

const router = express.Router();

// Health check endpoint for Render
router.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Debug endpoint for authentication environment variables
router.get('/debug-env', (req, res) => {
  // Only show this in development or with a specific debug flag
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_AUTH === 'true') {
    res.json({
      environment: process.env.NODE_ENV,
      frontendUrl: process.env.FRONTEND_URL,
      googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL,
      corsOrigin: process.env.CORS_ORIGIN
    });
  } else {
    res.status(403).json({ message: 'Debug endpoint disabled in production' });
  }
});

// Debug endpoint for session and authentication (disabled in production)
router.get('/debug-session', (req, res) => {
  if (process.env.NODE_ENV !== 'development' && process.env.DEBUG_AUTH !== 'true') {
    return res.status(403).json({ message: 'Debug endpoint disabled in production' });
  }
  res.json({
    isAuthenticated: req.isAuthenticated(),
    sessionID: req.sessionID,
    user: req.user || null,
    cookies: req.cookies || {},
    session: req.session || {}
  });
});

// Debug endpoint to test cookie setting (disabled in production)
router.get('/test-cookie', (req, res) => {
  if (process.env.NODE_ENV !== 'development' && process.env.DEBUG_AUTH !== 'true') {
    return res.status(403).json({ message: 'Debug endpoint disabled in production' });
  }
  // Set a test cookie
  res.cookie('test_cookie', 'cookie_value', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 3600000 // 1 hour
  });
  
  res.json({
    message: 'Test cookie set',
    cookieSet: true,
    timestamp: new Date().toISOString()
  });
});

// Middleware to ensure Google OAuth is configured before invoking passport strategy
const ensureGoogleAuthConfigured = (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      error: 'OAuth Not Configured',
      message: 'Google OAuth credentials are not configured on the server.'
    });
  }
  return next();
};

// Google OAuth routes
router.get('/google',
  ensureGoogleAuthConfigured,
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
router.get('/google/callback',
  ensureGoogleAuthConfigured,
  (req, res, next) => {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5174').replace(/\/+$/, '');
    passport.authenticate('google', {
      failureRedirect: `${frontendUrl}/login?error=auth_failed`,
      session: true
    })(req, res, next);
  },
  (req, res) => {
    // Ensure the session is saved before redirecting
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      }
      
      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5174').replace(/\/+$/, '');
      const redirectUrl = `${frontendUrl}?auth_success=true&uid=${req.user?.id || 'unknown'}`;
      
      // Redirect to frontend after successful login
      res.redirect(redirectUrl);
    });
  }
);


// Get current user
router.get('/me', isAuthenticated, (req, res) => {
  if (req.user) {
    return res.json({ user: req.user });
  }

  res.status(401).json({ error: 'Unauthorized', message: 'User is not authenticated' });
});

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

export default router; 