import express from 'express';
import session from 'express-session';
import signature from 'cookie-signature';
import { jest } from '@jest/globals';
import { generateSessionTicket, consumeSessionTicket } from '../utils/session-ticket.js';
import authRoutes from '../routes/auth.routes.js';

describe('Session Transfer & Same-Site Ticket Bridge Test Suite', () => {
  it('generates a 64-character hex ticket and consumes it exactly once', () => {
    const sessionId = 'test-session-12345';
    const userId = 'user-abc-6789';

    const ticket = generateSessionTicket(sessionId, userId);
    expect(typeof ticket).toBe('string');
    expect(ticket).toHaveLength(64); // 32 bytes hex = 64 chars

    // First consumption must succeed
    const consumed = consumeSessionTicket(ticket);
    expect(consumed).not.toBeNull();
    expect(consumed.sessionId).toBe(sessionId);
    expect(consumed.userId).toBe(userId);

    // Second consumption must fail (single-use enforcement)
    const replayed = consumeSessionTicket(ticket);
    expect(replayed).toBeNull();
  });

  it('rejects invalid or expired tickets', () => {
    expect(consumeSessionTicket(null)).toBeNull();
    expect(consumeSessionTicket('')).toBeNull();
    expect(consumeSessionTicket('non-existent-ticket-hex')).toBeNull();
  });

  it('signs and verifies session IDs using cookie-signature format', () => {
    const secret = 'super-secret-key-123';
    const sessionId = 'my-express-session-id';

    const signed = 's:' + signature.sign(sessionId, secret);
    expect(signed.startsWith('s:')).toBe(true);

    const unsigned = signature.unsign(signed.slice(2), secret);
    expect(unsigned).toBe(sessionId);

    // Tampered cookie must fail to unsign
    const tampered = signed + 'x';
    expect(signature.unsign(tampered.slice(2), secret)).toBe(false);
  });

  it('GET /auth/session-transfer sets bolt.sid cookie and redirects when given a valid ticket', async () => {
    const app = express();
    process.env.SESSION_SECRET = 'test-session-secret';
    process.env.FRONTEND_URL = 'https://mini-crm-deploy.vercel.app';

    app.use('/auth', authRoutes);

    const sessionId = 'valid-session-id-999';
    const userId = 'user-555';
    const ticket = generateSessionTicket(sessionId, userId);

    const responseHeaders = {};
    let redirectUrl = null;

    const req = {
      method: 'GET',
      url: `/session-transfer?ticket=${ticket}`,
      query: { ticket },
      get: (h) => (h === 'host' ? 'mini-crm-deploy.vercel.app' : ''),
    };

    const res = {
      statusCode: 200,
      cookie: (name, val, options) => {
        responseHeaders[name] = { val, options };
      },
      redirect: (url) => {
        redirectUrl = url;
      },
      setHeader: () => {},
    };

    // Find and run session-transfer handler
    const route = authRoutes.stack.find((layer) => layer.route && layer.route.path === '/session-transfer');
    expect(route).toBeDefined();

    await route.route.stack[0].handle(req, res);

    expect(redirectUrl).toContain('https://mini-crm-deploy.vercel.app');
    expect(redirectUrl).toContain('auth_success=true');
    expect(responseHeaders['bolt.sid']).toBeDefined();
    expect(responseHeaders['bolt.sid'].val.startsWith('s:')).toBe(true);
    expect(responseHeaders['bolt.sid'].options.httpOnly).toBe(true);
    expect(responseHeaders['bolt.sid'].options.sameSite).toBe('lax');

    // Verify the signed session ID matches original
    const unsignedId = signature.unsign(responseHeaders['bolt.sid'].val.slice(2), process.env.SESSION_SECRET);
    expect(unsignedId).toBe(sessionId);
  });

  it('GET /auth/session-transfer redirects to login with error on invalid ticket', async () => {
    const route = authRoutes.stack.find((layer) => layer.route && layer.route.path === '/session-transfer');

    let redirectUrl = null;
    const req = {
      method: 'GET',
      url: '/session-transfer?ticket=invalid-ticket',
      query: { ticket: 'invalid-ticket' },
      get: () => '',
    };
    const res = {
      redirect: (url) => {
        redirectUrl = url;
      },
    };

    await route.route.stack[0].handle(req, res);
    expect(redirectUrl).toContain('/login?error=session_expired');
  });
});
