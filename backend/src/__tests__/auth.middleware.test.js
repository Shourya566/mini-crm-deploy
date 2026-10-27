import { jest } from '@jest/globals';
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware.js';

describe('Authentication Middleware Security Test Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clone process.env to isolate test mutations
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Production Environment (NODE_ENV=production)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      // Attempt bypass in production - MUST BE IGNORED
      process.env.ALLOW_DEV_AUTH_BYPASS = 'true';
    });

    it('must reject unauthenticated requests with HTTP 401', () => {
      const req = {
        isAuthenticated: () => false,
        user: null
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      isAuthenticated(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Unauthorized',
        message: 'User is not authenticated'
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('must reject requests missing isAuthenticated function with HTTP 401', () => {
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      isAuthenticated(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('must allow authenticated requests through to next()', () => {
      const req = {
        isAuthenticated: () => true,
        user: { id: 'prod-user-1', email: 'user@example.com', role: 'user' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      isAuthenticated(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('must reject non-admin users with HTTP 403 on admin-protected endpoints', () => {
      const req = {
        isAuthenticated: () => true,
        user: { id: 'prod-user-1', email: 'user@example.com', role: 'user' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      isAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Forbidden',
        message: 'Admin access required'
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('must allow admin users through to next()', () => {
      const req = {
        isAuthenticated: () => true,
        user: { id: 'admin-user-1', email: 'admin@example.com', role: 'admin' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      isAdmin(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Development Environment (NODE_ENV=development)', () => {
    it('must reject unauthenticated requests when ALLOW_DEV_AUTH_BYPASS is not enabled', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ALLOW_DEV_AUTH_BYPASS;

      const req = {
        isAuthenticated: () => false,
        user: null
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      isAuthenticated(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('allows bypass only when ALLOW_DEV_AUTH_BYPASS=true and sets mock user', () => {
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_DEV_AUTH_BYPASS = 'true';

      const req = {
        isAuthenticated: () => false,
        user: null
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      isAuthenticated(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeDefined();
      expect(req.user.role).toBe('admin');
    });
  });
});
