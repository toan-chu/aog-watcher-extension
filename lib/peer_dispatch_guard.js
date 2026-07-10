export class PeerDispatchGuard {
  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
    this.claims = new Map();
  }

  claim(tagType, alertId, now = Date.now()) {
    this.cleanup(now);
    const key = `${tagType}:${alertId}`;
    if (this.claims.has(key)) return false;
    this.claims.set(key, now);
    return true;
  }

  release(tagType, alertId) {
    this.claims.delete(`${tagType}:${alertId}`);
  }

  cleanup(now = Date.now()) {
    for (const [key, claimedAt] of this.claims) {
      if (now - claimedAt >= this.ttlMs) this.claims.delete(key);
    }
  }
}

export async function dispatchPeerOnce(guard, tagType, alertId, send) {
  if (!guard.claim(tagType, alertId)) return { sent: false, duplicate: true };
  try {
    await send();
    return { sent: true, duplicate: false };
  } catch (error) {
    guard.release(tagType, alertId);
    throw error;
  }
}
