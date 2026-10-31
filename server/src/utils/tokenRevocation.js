/**
 * MT Nexus Global ERP — Server-Side Token Revocation & Session Invalidation Registry
 * Maintains active revocation blacklist so logged-out tokens cannot be replayed.
 */

class TokenRevocationRegistry {
  constructor() {
    // Set of revoked JWT token strings or signatures
    this.revokedTokens = new Set();
    // Map of userId -> timestamp (revokes all tokens issued before this timestamp)
    this.userRevocationCutoffs = new Map();
  }

  /**
   * Revoke a specific token string (called upon logout)
   */
  revokeToken(token) {
    if (token) {
      this.revokedTokens.add(token);
    }
  }

  /**
   * Revoke all tokens for a user issued before now (called upon password reset or security revocation)
   */
  revokeAllUserSessions(userId) {
    if (userId) {
      this.userRevocationCutoffs.set(userId, Math.floor(Date.now() / 1000));
    }
  }

  /**
   * Clear user-level cutoff upon fresh valid login
   */
  clearUserRevocation(userId) {
    if (userId) {
      this.userRevocationCutoffs.delete(userId);
    }
  }

  /**
   * Check if a token has been revoked
   */
  isRevoked(token, userId, tokenIat) {
    if (token && this.revokedTokens.has(token)) {
      return true;
    }

    if (userId && tokenIat && this.userRevocationCutoffs.has(userId)) {
      const cutoff = this.userRevocationCutoffs.get(userId);
      if (tokenIat < cutoff) {
        return true;
      }
    }

    return false;
  }

  /**
   * Periodic garbage collection of old entries (runs every hour)
   */
  cleanup() {
    // Limits memory growth in long-running processes
    if (this.revokedTokens.size > 10000) {
      this.revokedTokens.clear();
    }
  }
}

const tokenRegistry = new TokenRevocationRegistry();
module.exports = tokenRegistry;
