import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import campaignRoutes from './routes/campaign.routes.js';
import segmentRoutes from './routes/segment.routes.js';
import deliveryReceiptRoutes from './routes/delivery-receipt.routes.js';
import aiRoutes from './routes/ai.routes.js';

// Import passport configuration
import './config/passport.js';

// Import seed function
import { seedCustomers } from './utils/seed-customers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Trust reverse proxy in production (essential for Render / HTTPS cookies)
if (isProduction) {
  app.set('trust proxy', 1);
}

// Helper to parse comma-separated origin strings
const parseOrigins = (str) => {
  if (!str) return [];
  return str.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
};

// Configure CORS allowed origins
const defaultLocalOrigins = !isProduction ? [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
] : [];

const configuredOrigins = [
  ...parseOrigins(process.env.CORS_ORIGIN),
  ...parseOrigins(process.env.FRONTEND_URL),
];

const allowedOrigins = Array.from(new Set([
  ...defaultLocalOrigins,
  ...configuredOrigins,
]));

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow curl, health checks, or same-origin requests
  if (!isProduction) return true; // Allow local dev origins

  const cleanOrigin = origin.replace(/\/+$/, '');
  return allowedOrigins.includes(cleanOrigin);
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked request from disallowed origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Accept'],
  exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials'],
};

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors(corsOptions));

// Handle CORS preflight for all routes with the same credentials configuration
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Resolve MongoDB URI (with in-memory fallback for development)
let mongoUri = process.env.MONGODB_URI;
if (!mongoUri || mongoUri.trim() === '') {
  if (!isProduction) {
    console.log('ℹ️  No MONGODB_URI found. Initializing in-memory MongoDB for local development...');
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      process.env.MONGODB_URI = mongoUri;
      console.log(`✅ In-memory MongoDB running at: ${mongoUri}`);
    } catch (err) {
      console.error('Failed to start in-memory MongoDB server:', err);
      process.exit(1);
    }
  } else {
    console.error('❌ Fatal error: MONGODB_URI is required in production.');
    process.exit(1);
  }
}

// Connect to MongoDB
try {
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log('Connected to MongoDB');
  
  // Seed customers data if needed
  seedCustomers().catch(err => {
    console.error('Error seeding customers:', err);
  });
} catch (err) {
  console.error('MongoDB connection error:', err);
  process.exit(1);
}

// Validate session secret in production
const sessionSecret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
if (isProduction && !sessionSecret) {
  console.error('❌ Fatal error: JWT_SECRET (or SESSION_SECRET) is required in production.');
  process.exit(1);
}

// Session configuration
app.use(session({
  secret: sessionSecret || 'dev-only-session-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    client: mongoose.connection.getClient(),
    ttl: 24 * 60 * 60, // 1 day
    autoRemove: 'native',
    touchAfter: 24 * 3600 // time period in seconds
  }),
  cookie: {
    secure: isProduction, // Secure only in production over HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    sameSite: isProduction ? 'none' : 'lax', // Lax for local dev HTTP, None for cross-site prod
    path: '/'
  },
  name: 'bolt.sid'
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Debug middleware (only in development)
if (!isProduction) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/auth') || req.path.startsWith('/api')) {
      console.log(`[${req.method}] ${req.path} | Authenticated: ${req.isAuthenticated()}`);
    }
    next();
  });
}

// Informational root route
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Mini CRM API',
    status: 'running',
    healthCheck: '/healthz',
    endpoints: {
      health: '/healthz',
      auth: {
        me: '/auth/me',
        google: '/auth/google',
        logout: '/auth/logout'
      },
      api: {
        users: '/api/users',
        campaigns: '/api/campaigns',
        segments: '/api/segments',
        deliveryReceipts: '/api/delivery-receipts',
        ai: '/api/ai'
      }
    }
  });
});

// Health check route
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Mini CRM API is healthy', uptime: process.uptime() });
});

// Routes
app.use('/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/segments', segmentRoutes);
app.use('/api/delivery-receipts', deliveryReceiptRoutes);
app.use('/api/ai', aiRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
}); 