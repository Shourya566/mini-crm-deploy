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

// Configure CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []),
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin) return callback(null, true);
    if (!isProduction || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Accept'],
  exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials']
}));

// Add preflight OPTIONS handling
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

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
    serverSelectionTimeoutMS: 5000,
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

// Session configuration
app.use(session({
  secret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
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

// Health check routes
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
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
}); 