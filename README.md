# Mini CRM Project

A full-stack Customer Relationship Management application with authentication, campaign management, and customer segmentation.

## Features

- Google OAuth Authentication
- Customer management
- Campaign creation and tracking
- Customer segmentation
- Responsive dashboard with charts and analytics

## Tech Stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express
- Database: MongoDB
- Authentication: Passport.js with Google OAuth

## Deployment

This application can be deployed to Render with a single click:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Shourya566/mini-crm-deploy)

## Environment Variables

### Backend Environment Variables

Create a `.env` file in the backend directory with the following variables:

```
PORT=3001
NODE_ENV=development
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
FRONTEND_URL=http://localhost:5174
CORS_ORIGIN=http://localhost:5174
OPENAI_API_KEY=your_openai_api_key  # Optional
```

### Frontend Environment Variables

Create a `.env` file in the crm-frontend directory with the following variable:

```
VITE_API_URL=http://localhost:3001
VITE_AUTH_URL=http://localhost:3001/auth
```

## Local Development

1. Clone this repository:
```bash
git clone https://github.com/Shourya566/mini-crm-deploy.git
cd mini-crm-deploy
```

2. Install dependencies:
```bash
npm run install:all
```

3. Start the development servers:
```bash
npm run dev
```

4. Open your browser and navigate to http://localhost:5174

## License

MIT
# mini-crm-
