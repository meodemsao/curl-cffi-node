/**
 * Session State Isolation Tests
 *
 * Regression tests for persistent handle state leakage bugs (P2/P3/P4).
 * Verifies that HTTP method, headers, and body do NOT leak between
 * sequential requests on the same Session instance.
 *
 * NOTE: Uses httpbin.org because Session._request() uses synchronous
 * curl.perform() which blocks the event loop, making a local Node
 * HTTP server deadlock.
 */

import { describe, it, expect } from 'vitest';
import { Session, EXTERNAL } from '../helpers/fixtures';

const BASE = EXTERNAL.HTTPBIN;

describe('Session State Isolation (Regression)', () => {
  // ═══ P2 Regression: HTTP method must not leak between requests ═══════════

  describe('P2: Method isolation', () => {
    it('GET after POST uses GET method', async () => {
      const session = new Session();
      // First: POST
      const r1 = await session.post(`${BASE}/post`, { data: 'test-body' });
      expect(r1.status).toBe(200);

      // Second: GET — must NOT be POST
      const r2 = await session.get(`${BASE}/get`);
      expect(r2.status).toBe(200);
      expect(r2.json().url).toContain('/get');
    });

    it('DELETE after PUT uses DELETE method', async () => {
      const session = new Session();
      await session.put(`${BASE}/put`, { data: 'put-body' });
      const r = await session.delete(`${BASE}/delete`);
      expect(r.status).toBe(200);
    });

    it('GET after PATCH uses GET method', async () => {
      const session = new Session();
      await session.patch(`${BASE}/patch`, { data: 'patch-body' });
      const r = await session.get(`${BASE}/get`);
      expect(r.status).toBe(200);
      expect(r.json().url).toContain('/get');
    });

    it('method cycles correctly through POST → GET → PUT → GET', async () => {
      const session = new Session();

      const r1 = await session.post(`${BASE}/post`, { data: 'a' });
      expect(r1.status).toBe(200);

      const r2 = await session.get(`${BASE}/get`);
      expect(r2.status).toBe(200);

      const r3 = await session.put(`${BASE}/put`, { data: 'b' });
      expect(r3.status).toBe(200);

      const r4 = await session.get(`${BASE}/get`);
      expect(r4.status).toBe(200);
    });
  });

  // ═══ P3 Regression: POST body must not leak to subsequent requests ═══════

  describe('P3: Body isolation', () => {
    it('GET after POST does not send previous POST body', async () => {
      const session = new Session();
      // POST with sensitive data
      await session.post(`${BASE}/post`, {
        data: JSON.stringify({ secret: 'should-not-leak' }),
        headers: { 'Content-Type': 'application/json' },
      });

      // GET — httpbin /get returns empty data for GET
      const r = await session.get(`${BASE}/get`);
      const body = r.json();
      expect(body.data).toBeFalsy();
    });

    it('second POST with different body does not mix data', async () => {
      const session = new Session();

      const r1 = await session.post(`${BASE}/post`, {
        data: { req: 'first' },
      });
      expect(r1.json().json).toEqual({ req: 'first' });

      const r2 = await session.post(`${BASE}/post`, {
        data: { req: 'second' },
      });
      expect(r2.json().json).toEqual({ req: 'second' });
    });
  });

  // ═══ P4 Regression: Headers must not leak between requests ═══════════════

  describe('P4: Header isolation', () => {
    it('request headers do not leak to next request', async () => {
      const session = new Session();

      // Request with custom header
      await session.get(`${BASE}/headers`, {
        headers: { 'X-Secret': 'should-not-leak' },
      });

      // Next request — must not have X-Secret
      const r = await session.get(`${BASE}/headers`);
      const headers = r.json().headers;
      expect(headers['X-Secret']).toBeUndefined();
    });

    it('session-level headers persist but request-level headers do not', async () => {
      const session = new Session({
        headers: { 'X-Session-Level': 'persistent' },
      });

      // Request with extra header
      await session.get(`${BASE}/headers`, {
        headers: { 'X-Request-Level': 'transient' },
      });

      // Next request — session header persists, request header gone
      const r = await session.get(`${BASE}/headers`);
      const headers = r.json().headers;
      expect(headers['X-Session-Level']).toBe('persistent');
      expect(headers['X-Request-Level']).toBeUndefined();
    });
  });

  // ═══ Combined: Full lifecycle stress test ═════════════════════════════════

  describe('Combined state isolation', () => {
    it('6-request lifecycle with mixed methods preserves isolation', async () => {
      const session = new Session();

      // 1. GET
      const r1 = await session.get(`${BASE}/get`);
      expect(r1.status).toBe(200);

      // 2. POST with JSON body
      const r2 = await session.post(`${BASE}/post`, {
        data: { step: 2 },
      });
      expect(r2.status).toBe(200);
      expect(r2.json().json).toEqual({ step: 2 });

      // 3. GET — no body leak
      const r3 = await session.get(`${BASE}/get`);
      expect(r3.status).toBe(200);
      expect(r3.json().data).toBeFalsy();

      // 4. PUT with different body
      const r4 = await session.put(`${BASE}/put`, {
        data: { step: 4 },
      });
      expect(r4.status).toBe(200);

      // 5. DELETE — no body
      const r5 = await session.delete(`${BASE}/delete`);
      expect(r5.status).toBe(200);

      // 6. GET — clean slate
      const r6 = await session.get(`${BASE}/get`);
      expect(r6.status).toBe(200);
      expect(r6.json().data).toBeFalsy();
    });
  });
});
