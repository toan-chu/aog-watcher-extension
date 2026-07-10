import { describe, expect, it } from "vitest";
import { dispatchPeerOnce, PeerDispatchGuard } from "../lib/peer_dispatch_guard.js";

describe("PeerDispatchGuard", () => {
  it("allows only one claim for the same tag and alert inside the TTL", () => {
    const guard = new PeerDispatchGuard(300_000);
    expect(guard.claim("HANDLED", "alert-1", 1000)).toBe(true);
    expect(guard.claim("HANDLED", "alert-1", 2000)).toBe(false);
  });

  it("keeps HANDLED and ESCALATED claims independent", () => {
    const guard = new PeerDispatchGuard();
    expect(guard.claim("HANDLED", "alert-1", 1000)).toBe(true);
    expect(guard.claim("ESCALATED", "alert-1", 1000)).toBe(true);
  });

  it("allows a later attempt after a failed send releases the claim", () => {
    const guard = new PeerDispatchGuard();
    guard.claim("HANDLED", "alert-1", 1000);
    guard.release("HANDLED", "alert-1");
    expect(guard.claim("HANDLED", "alert-1", 2000)).toBe(true);
  });

  it("expires claims after five minutes", () => {
    const guard = new PeerDispatchGuard(300_000);
    guard.claim("HANDLED", "alert-1", 1000);
    expect(guard.claim("HANDLED", "alert-1", 301000)).toBe(true);
  });

  it("dispatches duplicate requests only once", async () => {
    const guard = new PeerDispatchGuard();
    let sends = 0;
    const send = async () => { sends += 1; };
    await dispatchPeerOnce(guard, "HANDLED", "alert-1", send);
    const duplicate = await dispatchPeerOnce(guard, "HANDLED", "alert-1", send);
    expect(sends).toBe(1);
    expect(duplicate).toEqual({ sent: false, duplicate: true });
  });

  it("retries after the send boundary fails", async () => {
    const guard = new PeerDispatchGuard();
    await expect(dispatchPeerOnce(guard, "HANDLED", "alert-1", async () => { throw new Error("DOM unavailable"); })).rejects.toThrow("DOM unavailable");
    await expect(dispatchPeerOnce(guard, "HANDLED", "alert-1", async () => {})).resolves.toMatchObject({ sent: true });
  });
});
