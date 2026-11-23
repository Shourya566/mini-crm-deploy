import cors from 'cors';
import { jest } from '@jest/globals';
import { buildAllowedOrigins, createCorsOptions, normalizeOrigin, parseOrigins } from '../config/cors.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';

const runCorsMiddleware = (middleware, { method = 'GET', headers = {} }) =>
  new Promise((resolve, reject) => {
    const responseHeaders = {};
    const req = {
      method,
      headers,
    };
    const res = {
      statusCode: 200,
      setHeader(name, value) {
        responseHeaders[name.toLowerCase()] = value;
      },
      getHeader(name) {
        return responseHeaders[name.toLowerCase()];
      },
      end() {
        resolve({ status: this.statusCode, headers: responseHeaders, nextCalled: false });
      },
    };

    middleware(req, res, (err) => {
      if (err) return reject(err);
      resolve({ status: res.statusCode, headers: responseHeaders, nextCalled: true });
    });
  });

describe('CORS Configuration & Preflight Test Suite', () => {
  const { corsOptions } = createCorsOptions({
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://mini-crm-deploy.vercel.app/',
    CORS_ORIGIN: 'https://mini-crm-deploy.vercel.app, * , https://extra.example.com/',
  });
  const corsMiddleware = cors(corsOptions);

  it('normalizes origins and strips trailing slashes and wildcards', () => {
    expect(normalizeOrigin('https://mini-crm-deploy.vercel.app/')).toBe('https://mini-crm-deploy.vercel.app');
    expect(normalizeOrigin('  *  ')).toBe('');
    expect(parseOrigins('https://a.com/, *, https://b.com ')).toEqual(['https://a.com', 'https://b.com']);
  });

  it('always includes the production Vercel origin and localhost origins without wildcards', () => {
    const origins = buildAllowedOrigins({ CORS_ORIGIN: '*' });
    expect(origins).toContain('https://mini-crm-deploy.vercel.app');
    expect(origins).toContain('http://localhost:5174');
    expect(origins).toContain('http://localhost:5173');
    expect(origins).not.toContain('*');
  });

  it('handles OPTIONS preflight for /auth/me from https://mini-crm-deploy.vercel.app with credentials', async () => {
    const res = await runCorsMiddleware(corsMiddleware, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://mini-crm-deploy.vercel.app',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'cache-control,content-type',
      },
    });

    expect(res.status).toBe(204);
    expect(res.nextCalled).toBe(false);
    expect(res.headers['access-control-allow-origin']).toBe('https://mini-crm-deploy.vercel.app');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-headers']).toMatch(/Cache-Control/i);
    expect(res.headers['access-control-allow-methods']).toMatch(/OPTIONS/);
  });

  it('sets Access-Control-Allow-Origin and credentials on GET /auth/me even when unauthenticated (401)', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const corsRes = await runCorsMiddleware(corsMiddleware, {
        method: 'GET',
        headers: {
          origin: 'https://mini-crm-deploy.vercel.app',
        },
      });

      expect(corsRes.nextCalled).toBe(true);
      expect(corsRes.headers['access-control-allow-origin']).toBe('https://mini-crm-deploy.vercel.app');
      expect(corsRes.headers['access-control-allow-credentials']).toBe('true');

      const authReq = { isAuthenticated: () => false, user: null };
      const authRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const authNext = jest.fn();
      isAuthenticated(authReq, authRes, authNext);
      expect(authRes.status).toHaveBeenCalledWith(401);
      expect(authNext).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('handles OPTIONS preflight from localhost development origins', async () => {
    const res = await runCorsMiddleware(corsMiddleware, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5174',
        'access-control-request-method': 'GET',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5174');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('blocks disallowed origins without setting Access-Control-Allow-Origin or throwing an error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const res = await runCorsMiddleware(corsMiddleware, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://evil-attacker.example.com',
          'access-control-request-method': 'GET',
        },
      });

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
