const DEFAULT_PRODUCTION_ORIGINS = [
  'https://mini-crm-deploy.vercel.app',
];

const DEFAULT_LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

/**
 * Normalize an origin string by trimming whitespace and stripping trailing slashes.
 * Explicitly rejects wildcard '*' because credentials: true forbids wildcard origins.
 */
export const normalizeOrigin = (origin) => {
  if (!origin || typeof origin !== 'string') return '';
  const trimmed = origin.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed === '*') return '';
  return trimmed;
};

/**
 * Parse a comma-separated environment variable into a list of normalized origins.
 */
export const parseOrigins = (envValue) => {
  if (!envValue || typeof envValue !== 'string') return [];
  return envValue
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
};

/**
 * Build the deduplicated list of allowed CORS origins from defaults and environment variables.
 */
export const buildAllowedOrigins = (env = process.env) => {
  const configuredOrigins = [
    ...parseOrigins(env.CORS_ORIGIN),
    ...parseOrigins(env.FRONTEND_URL),
  ];

  return Array.from(new Set([
    ...DEFAULT_PRODUCTION_ORIGINS,
    ...DEFAULT_LOCAL_ORIGINS,
    ...configuredOrigins,
  ]));
};

/**
 * Create production-safe CORS options supporting credentialed cross-origin requests
 * and OPTIONS preflight without wildcard origins.
 */
export const createCorsOptions = (env = process.env) => {
  const allowedOrigins = buildAllowedOrigins(env);

  return {
    allowedOrigins,
    corsOptions: {
      origin: (origin, callback) => {
        // Allow requests with no Origin header (health checks, curl, server-to-server)
        if (!origin) {
          return callback(null, true);
        }

        const cleanOrigin = normalizeOrigin(origin);
        if (cleanOrigin && allowedOrigins.includes(cleanOrigin)) {
          // Reflect the exact validated origin (never '*')
          return callback(null, true);
        }

        console.warn(`[CORS] Blocked request from disallowed origin: ${origin}`);
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Cache-Control',
        'Accept',
        'X-Requested-With',
        'Pragma',
      ],
      exposedHeaders: ['Set-Cookie'],
      optionsSuccessStatus: 204,
      preflightContinue: false,
    },
  };
};
