/**
 * Epic 6: WebSocket Support
 *
 * Tests WebSocket connection, send/receive, and event lifecycle.
 * Uses event-driven helpers instead of magic timeouts.
 */

import { describe, it, expect } from 'vitest';
import { CurlWebSocket, Curl, CurlOpt, EXTERNAL, SLOW_TIMEOUT_MS } from '../helpers/fixtures';
import { connectAndWait, sendAndReceive, echoRoundTrip, collectEvents, waitForEvent } from '../helpers/ws-helpers';

describe('Epic 6: WebSocket Support', () => {
  // ═══ Story 6.1: WebSocket Connection with Impersonated TLS ════════════

  describe('Story 6.1: WebSocket Connection', () => {
    it('connects to wss:// with impersonation', async () => {
      const ws = new CurlWebSocket(EXTERNAL.WS_ECHO, {
        impersonate: 'chrome116',
      });

      await connectAndWait(ws, SLOW_TIMEOUT_MS);
      expect(ws.connected).toBe(true);
      ws.close();
    });

    it('reports connected state transitions', async () => {
      const ws = new CurlWebSocket(EXTERNAL.WS_ECHO);
      expect(ws.connected).toBe(false);

      await connectAndWait(ws, SLOW_TIMEOUT_MS);
      expect(ws.connected).toBe(true);

      ws.close();
      expect(ws.connected).toBe(false);
    });

    it('emits error on invalid URL', async () => {
      const ws = new CurlWebSocket('wss://invalid.nonexistent.domain.xyz');
      try {
        await ws.connect();
        expect.unreachable('should have thrown');
      } catch (e: any) {
        expect(e.message).toBeDefined();
      }
    });
  });

  // ═══ Story 6.2: WebSocket Send/Receive & Events ══════════════════════

  describe('Story 6.2: Send/Receive & Events', () => {
    it('text echo round-trip', async () => {
      const ws = new CurlWebSocket(EXTERNAL.WS_ECHO, {
        impersonate: 'chrome110',
      });

      const reply = await echoRoundTrip(ws, 'Hello curl-cffi-node!', SLOW_TIMEOUT_MS);
      expect(reply).toBe('Hello curl-cffi-node!');
    });

    it('binary send does not throw', async () => {
      const ws = new CurlWebSocket(EXTERNAL.WS_ECHO);
      const original = Buffer.from([0x01, 0x02, 0x03, 0xFF]);

      await connectAndWait(ws, SLOW_TIMEOUT_MS);
      expect(() => ws.send(original)).not.toThrow();
      ws.close();
    });

    it('emits open and close events in order', async () => {
      const ws = new CurlWebSocket(EXTERNAL.WS_ECHO);

      const events = await collectEvents(ws, async () => {
        await connectAndWait(ws, SLOW_TIMEOUT_MS);
        ws.close();
      }, SLOW_TIMEOUT_MS);

      expect(events).toContain('open');
      expect(events).toContain('close');
      expect(events.indexOf('open')).toBeLessThan(events.indexOf('close'));
    });

    it('close prevents further sending', async () => {
      const ws = new CurlWebSocket(EXTERNAL.WS_ECHO);

      await connectAndWait(ws, SLOW_TIMEOUT_MS);
      ws.close();
      expect(() => ws.send('after close')).toThrow(/not connected/);
    });

    it('native-level ws methods work', async () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, EXTERNAL.WS_ECHO);
      curl.setoptLong(CurlOpt.FollowLocation, 1);
      curl.wsConnect();

      // Send
      curl.wsSend(Buffer.from('test'), 1); // WS_TEXT

      // Receive with event-driven retry
      let frame = null;
      for (let i = 0; i < 50; i++) {
        frame = curl.wsRecv();
        if (frame) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      expect(frame).not.toBeNull();
      expect(frame.data.toString()).toBe('test');
    });
  });
});
