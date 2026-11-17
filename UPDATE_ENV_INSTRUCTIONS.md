# Environment Files Update Instructions

To complete your deployment to Render, you need to update your environment files with the correct URLs. Here are the steps:

## 1. Update Backend Environment File (backend/.env)

Edit your `backend/.env` file and update these variables:

```
NODE_ENV=production
CORS_ORIGIN=https://mini-crm-frontend-yt2n.onrender.com
FRONTEND_URL=https://mini-crm-frontend-yt2n.onrender.com
GOOGLE_CALLBACK_URL=https://mini-crm-backend-1z1s.onrender.com/auth/google/callback
```

## 2. Update Frontend Environment File (crm-frontend/.env)

Edit your `crm-frontend/.env` file and update these variables:

```
VITE_API_URL=https://mini-crm-backend-1z1s.onrender.com
VITE_AUTH_URL=https://mini-crm-backend-1z1s.onrender.com/auth
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

## 3. Google OAuth Configuration

Make sure to update your Google OAuth configuration in the Google Cloud Console:

1. Go to https://console.cloud.google.com/apis/credentials
2. Edit your OAuth client
3. Add these Authorized JavaScript origins:
   - https://mini-crm-frontend-yt2n.onrender.com
   - http://localhost:5174 (for local development)
4. Add these Authorized redirect URIs:
   - https://mini-crm-backend-1z1s.onrender.com/auth/google/callback
   - http://localhost:3001/auth/google/callback (for local development)

## 4. Rebuild and Deploy

After updating these files, commit and push your changes, then redeploy your application on Render. 