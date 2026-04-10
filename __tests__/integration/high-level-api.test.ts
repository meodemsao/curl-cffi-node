/**
 * Epic 3: High-Level HTTP Client
 *
 * Tests Response, Headers, Error Hierarchy, Session methods,
 * shorthand functions, and timing.
 *
 * NOTE: Uses httpbin.org because Session internally calls sync perform()
 * which blocks the event loop, preventing local Node HTTP servers from responding.
 */

import { describe, it, expect } from 'vitest';
import {
  Session,
  get, post, del,
  CurlError, TimeoutError, ConnectionError,
  CurlCode, parseCurlError,
  EXTERNAL,
} from '../helpers/fixtures';

const BASE = EXTERNAL.HTTPBIN;

describe('Epic 3: High-Level HTTP Client', () => {
  // ═══ Story 3.1: Response Class ═══════════════════════════════════════════

  describe('Story 3.1: Response Class', () => {
    it('response.status returns HTTP status code', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/status/200`);
      expect(r.status).toBe(200);
    });

    it('response.ok is true for 2xx status', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/get`);
      expect(r.ok).toBe(true);
    });

    it('response.ok is false for 4xx status', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/status/404`);
      expect(r.ok).toBe(false);
    });

    it('response.url returns effective URL after redirects', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/redirect/1`);
      expect(r.url).toContain('httpbin.org/get');
    });

    it('response.text() returns UTF-8 string', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/get`);
      const text = r.text();
      expect(typeof text).toBe('string');
      expect(text).toContain('"url"');
    });

    it('response.json() returns parsed JSON', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/get`);
      const data = r.json();
      expect(data.url).toBe('https://httpbin.org/get');
    });

    it('response.buffer() returns Buffer', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/get`);
      const buf = r.buffer();
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(0);
    });

    it('response.elapsed returns positive ms', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/get`);
      expect(r.elapsed).toBeGreaterThan(0);
    });
  });

  // ═══ Story 3.1: Headers Class ═══════════════════════════════════════════

  describe('Story 3.1: Headers Class', () => {
    it('headers.get() is case-insensitive', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/get`);
      const ct = r.headers.get('Content-Type');
      const ctLower = r.headers.get('content-type');
      expect(ct).toBe(ctLower);
      expect(ct).toContain('application/json');
    });

    it('headers.has() checks existence', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/get`);
      expect(r.headers.has('content-type')).toBe(true);
      expect(r.headers.has('x-nonexistent')).toBe(false);
    });

    it('headers.get() returns null for missing', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/get`);
      expect(r.headers.get('x-does-not-exist')).toBeNull();
    });
  });

  // ═══ Story 3.2: Typed Error Hierarchy ═══════════════════════════════════

  describe('Story 3.2: Typed Error Hierarchy', () => {
    it('CurlError has code and curlMessage', () => {
      const err = new CurlError(7, 'connection refused');
      expect(err.code).toBe(7);
      expect(err.curlMessage).toBe('connection refused');
      expect(err.message).toContain('curl error (7)');
      expect(err instanceof Error).toBe(true);
    });

    it('TimeoutError extends CurlError', () => {
      const err = new TimeoutError('operation timed out');
      expect(err instanceof CurlError).toBe(true);
      expect(err instanceof TimeoutError).toBe(true);
      expect(err.code).toBe(CurlCode.OPERATION_TIMEDOUT);
    });

    it('ConnectionError extends CurlError', () => {
      const err = new ConnectionError(7, 'failed to connect');
      expect(err instanceof CurlError).toBe(true);
      expect(err instanceof ConnectionError).toBe(true);
    });

    it('parseCurlError creates TimeoutError for code 28', () => {
      const err = parseCurlError('curl error (28): Operation timed out');
      expect(err instanceof TimeoutError).toBe(true);
      expect(err.code).toBe(28);
    });

    it('parseCurlError creates ConnectionError for code 7', () => {
      const err = parseCurlError('curl error (7): Failed to connect');
      expect(err instanceof ConnectionError).toBe(true);
    });

    it('timeout throws TimeoutError', async () => {
      const session = new Session({ timeout: 1 });
      try {
        await session.get(`${BASE}/delay/10`);
        expect.unreachable('should have thrown');
      } catch (e: any) {
        expect(e instanceof TimeoutError).toBe(true);
        expect(e.code).toBe(28);
      }
    });

    it('HTTP 4xx does NOT throw, returns Response', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/status/404`);
      expect(r.status).toBe(404);
      expect(r.ok).toBe(false);
    });
  });

  // ═══ Story 3.3: Session Class — HTTP Methods ═══════════════════════════

  describe('Story 3.3: Session HTTP Methods', () => {
    it('GET request', async () => {
      const session = new Session({ impersonate: 'chrome110' });
      const r = await session.get(`${BASE}/get`);
      expect(r.status).toBe(200);
    });

    it('POST with JSON data', async () => {
      const session = new Session();
      const r = await session.post(`${BASE}/post`, {
        data: { key: 'value' },
      });
      expect(r.status).toBe(200);
      const body = r.json();
      expect(JSON.parse(body.data)).toEqual({ key: 'value' });
    });

    it('PUT request', async () => {
      const session = new Session();
      const r = await session.put(`${BASE}/put`, {
        data: 'test body',
      });
      expect(r.status).toBe(200);
    });

    it('DELETE request', async () => {
      const session = new Session();
      const r = await session.delete(`${BASE}/delete`);
      expect(r.status).toBe(200);
    });

    it('PATCH request', async () => {
      const session = new Session();
      const r = await session.patch(`${BASE}/patch`);
      expect(r.status).toBe(200);
    });

    it('custom headers are sent', async () => {
      const session = new Session({ headers: { 'X-Session': 'default' } });
      const r = await session.get(`${BASE}/headers`, {
        headers: { 'X-Request': 'override' },
      });
      const hdrs = r.json().headers;
      expect(hdrs['X-Session']).toBe('default');
      expect(hdrs['X-Request']).toBe('override');
    });

    it('query params are appended', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/get`, {
        params: { foo: 'bar', count: 42 },
      });
      const body = r.json();
      expect(body.args.foo).toBe('bar');
      expect(body.args.count).toBe('42');
    });
  });

  // ═══ Story 3.4: Request Options ═══════════════════════════════════════

  describe('Story 3.4: Request Options', () => {
    it('timeout option throws TimeoutError', async () => {
      const session = new Session();
      try {
        await session.get(`${BASE}/delay/10`, { timeout: 1 });
        expect.unreachable('should have thrown');
      } catch (e: any) {
        expect(e instanceof TimeoutError).toBe(true);
      }
    });

    it('followRedirects=false returns 302', async () => {
      const session = new Session({ followRedirects: false });
      const r = await session.get(`${BASE}/redirect/1`);
      expect(r.status).toBeGreaterThanOrEqual(300);
      expect(r.status).toBeLessThan(400);
    });

    it('followRedirects=true follows to destination', async () => {
      const session = new Session({ followRedirects: true });
      const r = await session.get(`${BASE}/redirect/1`);
      expect(r.status).toBe(200);
      expect(r.url).toContain('httpbin.org/get');
    });
  });

  // ═══ Story 3.5: Shorthand Functions ═══════════════════════════════════

  describe('Story 3.5: Shorthand Functions', () => {
    it('get() shorthand works', async () => {
      const r = await get(`${BASE}/get`, { impersonate: 'chrome110' });
      expect(r.status).toBe(200);
      expect(r.ok).toBe(true);
    });

    it('post() shorthand with data', async () => {
      const r = await post(`${BASE}/post`, {
        data: { hello: 'world' },
      });
      expect(r.status).toBe(200);
    });

    it('del() shorthand works', async () => {
      const r = await del(`${BASE}/delete`);
      expect(r.status).toBe(200);
    });
  });

  // ═══ Story 3.6: Timing Information ═══════════════════════════════════

  describe('Story 3.6: Response Timing', () => {
    it('timing has all fields', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/get`);
      expect(r.timing).toBeDefined();
      expect(typeof r.timing.dns).toBe('number');
      expect(typeof r.timing.connect).toBe('number');
      expect(typeof r.timing.tls).toBe('number');
      expect(typeof r.timing.total).toBe('number');
    });

    it('timing.total is positive', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/get`);
      expect(r.timing.total).toBeGreaterThan(0);
    });

    it('timing.dns <= timing.connect <= timing.total', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/get`);
      expect(r.timing.dns).toBeLessThanOrEqual(r.timing.connect);
      expect(r.timing.connect).toBeLessThanOrEqual(r.timing.total);
    });

    it('timing.tls is positive for HTTPS', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/get`);
      expect(r.timing.tls).toBeGreaterThan(0);
    });

    it('response.elapsed matches timing.total', async () => {
      const session = new Session();
      const r = await session.get(`${BASE}/get`);
      expect(r.elapsed).toBeCloseTo(r.timing.total, 0);
    });
  });
});
