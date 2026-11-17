# Complete OAuth Authentication Fix

The issue is occurring in multiple places. Here's a comprehensive solution to fix all authentication redirection issues:

## 1. Fix the Frontend Authentication Code

Edit the file `crm-frontend/src/contexts/AuthContext.jsx` and update the login function:

```javascript
const login = () => {
  try {
    console.log('Initiating Google OAuth login...');
    // Use the VITE_AUTH_URL environment variable instead of api.defaults.baseURL
    window.location.href = `${import.meta.env.VITE_AUTH_URL || api.defaults.baseURL}/google`;
  } catch (error) {
    console.error('Login redirect failed:', error);
    setError('Login failed');
  }
};
```

## 2. Update .env Files for Both Frontend and Backend

### Frontend .env (crm-frontend/.env)
```
VITE_API_URL=https://mini-crm-backend-1z1s.onrender.com
VITE_AUTH_URL=https://mini-crm-backend-1z1s.onrender.com/auth
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

### Backend .env (backend/.env)
```
NODE_ENV=production
CORS_ORIGIN=https://mini-crm-frontend-yt2n.onrender.com
FRONTEND_URL=https://mini-crm-frontend-yt2n.onrender.com
GOOGLE_CALLBACK_URL=https://mini-crm-backend-1z1s.onrender.com/auth/google/callback
```

## 3. Update Google Cloud Console Settings

1. Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID and edit it
3. Update the settings as follows:

**Authorized JavaScript Origins:**
- https://mini-crm-frontend-yt2n.onrender.com
- https://mini-crm-backend-1z1s.onrender.com
- http://localhost:5174 (for development)
- http://localhost:3001 (for development)

**Authorized Redirect URIs:**
- https://mini-crm-backend-1z1s.onrender.com/auth/google/callback
- http://localhost:3001/auth/google/callback (for development)

## 4. Fix CORS and Session Configuration

This has already been done in the latest code updates to backend/src/server.js:
- CORS is configured to accept requests from your frontend domain
- Session cookies are set with sameSite='none' to work across domains

## 5. Fix Redirect URL in Auth Routes

This has also been fixed in the backend/src/routes/auth.routes.js to use the FRONTEND_URL environment variable.

## 6. Test the Complete Flow

1. Make the changes to the AuthContext.jsx file
2. Update your .env files on Render (or locally if testing locally)
3. Redeploy both services
4. Try logging in again

## 7. Debug Issues

If you're still having problems:

1. Check browser console during authentication for errors
2. Check Network tab in developer tools and look for:
   - Redirects to localhost URLs
   - CORS errors
   - Cookie issues (credentials)
3. Check Render logs for both services

This combined approach addresses all the possible points where redirection could be going wrong. 