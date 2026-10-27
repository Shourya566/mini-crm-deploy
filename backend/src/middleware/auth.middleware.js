/**
 * Authentication Middleware
 * 
 * Enforces session-based authentication on protected routes.
 * In production (NODE_ENV=production), authentication is strictly required.
 * In development, an explicit opt-in environment variable (ALLOW_DEV_AUTH_BYPASS=true)
 * can be used for local offline testing.
 */

export const isAuthenticated = (req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevBypass = !isProduction && process.env.ALLOW_DEV_AUTH_BYPASS === 'true';

  // Development-only bypass (strictly disabled in production)
  if (isDevBypass) {
    if (!req.user) {
      req.user = {
        id: 'dev-user-123',
        googleId: '123456789',
        email: 'dev@example.com',
        displayName: 'Development User',
        role: 'admin'
      };
    }
    return next();
  }

  // Standard authentication check via Passport session
  if (typeof req.isAuthenticated === 'function' && req.isAuthenticated()) {
    return next();
  }

  return res.status(401).json({ 
    error: 'Unauthorized', 
    message: 'User is not authenticated'
  });
};

export const isAdmin = (req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevBypass = !isProduction && process.env.ALLOW_DEV_AUTH_BYPASS === 'true';

  // Development-only bypass (strictly disabled in production)
  if (isDevBypass) {
    return next();
  }

  if (typeof req.isAuthenticated === 'function' && req.isAuthenticated() && req.user?.role === 'admin') {
    return next();
  }

  return res.status(403).json({ 
    error: 'Forbidden', 
    message: 'Admin access required' 
  });
};