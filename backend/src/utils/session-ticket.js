import crypto from 'crypto';

const sessionTickets = new Map();

/**
 * Generates a cryptographically secure, single-use ticket for cross-domain session transfer.
 * Expires automatically after 60 seconds.
 *
 * @param {string} sessionId - The Express session ID
 * @param {string} userId - The authenticated user's ID
 * @returns {string} Single-use random ticket hex string
 */
export const generateSessionTicket = (sessionId, userId) => {
  const ticket = crypto.randomBytes(32).toString('hex');
  sessionTickets.set(ticket, {
    sessionId,
    userId,
    expiresAt: Date.now() + 60000, // 60 seconds TTL
  });
  return ticket;
};

/**
 * Validates and consumes a session transfer ticket.
 * Enforces single-use consumption: immediately deletes ticket upon retrieval.
 *
 * @param {string} ticket - The ticket hex string
 * @returns {Object|null} Ticket data if valid and not expired, otherwise null
 */
export const consumeSessionTicket = (ticket) => {
  if (!ticket || typeof ticket !== 'string') return null;
  const data = sessionTickets.get(ticket);
  if (!data) return null;

  sessionTickets.delete(ticket); // Single-use consumption
  if (Date.now() > data.expiresAt) return null; // Reject expired

  return data;
};

// Periodic cleanup of expired tickets
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, data] of sessionTickets.entries()) {
    if (now > data.expiresAt) {
      sessionTickets.delete(key);
    }
  }
}, 120000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}
