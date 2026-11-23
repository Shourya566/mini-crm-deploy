import express from 'express';
import passport from 'passport';
import signature from 'cookie-signature';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { generateSessionTicket, consumeSessionTicket } from '../utils/session-ticket.js';

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

const getFrontendUrl = () => {
  const defaultUrl = process.env.NODE_ENV === 'production'
    ? 'https://mini-crm-deploy.vercel.app'
    : 'http://localhost:5174';
  return (process.env.FRONTEND_URL || defaultUrl).trim().replace(/\/+$/, '');
};

// Google OAuth callback
router.get('/google/callback',
  ensureGoogleAuthConfigured,
  (req, res, next) => {
    const frontendUrl = getFrontendUrl();
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
      
      const frontendUrl = getFrontendUrl();
      const host = (req.get('x-forwarded-host') || req.get('host') || '').toLowerCase();
      
      // If the callback arrived directly on Render (cross-site from Vercel frontend),
      // bridge the session to the Vercel domain via single-use ticket transfer
      // so the cookie becomes a first-party cookie on the frontend domain.
      if (host.includes('onrender.com') && frontendUrl.includes('vercel.app')) {
        const ticket = generateSessionTicket(req.sessionID, req.user?.id);
        const transferUrl = `${frontendUrl}/auth/session-transfer?ticket=${ticket}`;
        console.log(`[Auth] Bridging session from ${host} to ${frontendUrl} via secure ticket`);
        return res.redirect(transferUrl);
      }
      
      const redirectUrl = `${frontendUrl}/?auth_success=true&uid=${req.user?.id || 'unknown'}`;
      res.redirect(redirectUrl);
    });
  }
);

// Secure single-use session transfer endpoint (bridges session to same-site frontend domain)
router.get('/session-transfer', (req, res) => {
  const { ticket } = req.query;
  const frontendUrl = getFrontendUrl();

  if (!ticket || typeof ticket !== 'string') {
    return res.redirect(`${frontendUrl}/login?error=invalid_ticket`);
  }

  const ticketData = consumeSessionTicket(ticket);
  if (!ticketData) {
    console.warn('[Auth] Expired or invalid session ticket');
    return res.redirect(`${frontendUrl}/login?error=session_expired`);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const sessionSecret = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'dev-only-session-secret';
  const signedCookieValue = 's:' + signature.sign(ticketData.sessionId, sessionSecret);

  // Set the bolt.sid session cookie on this response.
  // Because this request is routed through Vercel (https://mini-crm-deploy.vercel.app/auth/session-transfer),
  // the cookie is stored as a 100% FIRST-PARTY cookie on mini-crm-deploy.vercel.app!
  res.cookie('bolt.sid', signedCookieValue, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? (process.env.COOKIE_SAMESITE || 'lax') : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    path: '/'
  });

  return res.redirect(`${frontendUrl}/?auth_success=true&uid=${ticketData.userId || 'unknown'}`);
});


// Get current user
router.get('/me', isAuthenticated, (req, res) => {
  if (req.user) {
    return res.json({ user: req.user });
  }

  res.status(401).json({ error: 'Unauthorized', message: 'User is not authenticated' });
});

// Logout
router.get('/logout', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const sameSite = isProduction ? (process.env.COOKIE_SAMESITE || 'lax') : 'lax';

  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    if (req.session) {
      req.session.destroy(() => {
        res.clearCookie('bolt.sid', {
          httpOnly: true,
          secure: isProduction,
          sameSite,
          path: '/'
        });
        res.json({ message: 'Logged out successfully' });
      });
    } else {
      res.clearCookie('bolt.sid', {
        httpOnly: true,
        secure: isProduction,
        sameSite,
        path: '/'
      });
      res.json({ message: 'Logged out successfully' });
    }
  });
});

export default router; 