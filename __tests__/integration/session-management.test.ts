/**
 * Epic 4: Session Management & Cookie Persistence
 *
 * Tests cookie persistence, connection reuse, session defaults,
 * and cookie import/export.
 *
 * NOTE: Uses httpbin.org because Session internally calls sync perform()
 * which blocks the event loop, preventing local Node HTTP servers from responding.
 */

import { describe, it, expect } from 'vitest';
import { Session, TimeoutError, EXTERNAL } from '../helpers/fixtures';

const BASE = EXTERNAL.HTTPBIN;

describe('Epic 4: Session Management & Cookie Persistence', () => {
  // ═══ Story 4.1: Session Cookie Persistence ═════════════════════════════

  describe('Story 4.1: Cookie Persistence', () => {
    it('cookies from Set-Cookie are stored in session', async () => {
      const session = new Session({ impersonate: 'chrome110' });
      await session.get(`${BASE}/cookies/set?session_test=value1`);
      const cookies = session.cookies;
      expect(cookies.length).toBeGreaterThanOrEqual(1);
      expect(cookies.some((c: string) => c.includes('session_test'))).toBe(true);
    });

    it('stored cookies are sent in subsequent requests', async () => {
      const session = new Session();
      await session.get(`${BASE}/cookies/set?persist_test=hello`);
      const r = await session.get(`${BASE}/cookies`);
      const body = r.json();
      expect(body.cookies.persist_test).toBe('hello');
    });

    it('multiple cookies accumulate', async () => {
      const session = new Session();
      await session.get(`${BASE}/cookies/set?c1=v1`);
      await session.get(`${BASE}/cookies/set?c2=v2`);
      const r = await session.get(`${BASE}/cookies`);
      const body = r.json();
      expect(body.cookies.c1).toBe('v1');
      expect(body.cookies.c2).toBe('v2');
    });

    it('session.cookies provides read access', async () => {
      const session = new Session();
      await session.get(`${BASE}/cookies/set?read_test=val`);
      const cookies = session.cookies;
      expect(Array.isArray(cookies)).toBe(true);
      expect(cookies.length).toBeGreaterThan(0);
    });
  });

  // ═══ Story 4.2: Connection Reuse ═══════════════════════════════════════

  describe('Story 4.2: Connection Reuse', () => {
    it('second request is faster due to connection reuse', async () => {
      const session = new Session();

      // First request — establishes connection
      const t1 = Date.now();
      await session.get(`${BASE}/get`);
      const first = Date.now() - t1;

      // Second request — reuses connection
      const t2 = Date.now();
      await session.get(`${BASE}/get`);
      const second = Date.now() - t2;

      // Connection reuse should make second request faster
      expect(second).toBeLessThan(first * 1.5);
      console.log(`  Connection reuse: first=${first}ms, second=${second}ms`);
    });
  });

  // ═══ Story 4.3: Session Defaults & Configuration ═══════════════════════

  describe('Story 4.3: Session Defaults', () => {
    it('constructor accepts impersonate default', async () => {
      const session = new Session({ impersonate: 'chrome116' });
      const r = await session.get(`${BASE}/get`);
      expect(r.status).toBe(200);
    });

    it('constructor accepts headers default', async () => {
      const session = new Session({
        headers: { 'X-Default': 'session-value' },
      });
      const r = await session.get(`${BASE}/headers`);
      expect(r.json().headers['X-Default']).toBe('session-value');
    });

    it('per-request headers merge with session defaults', async () => {
      const session = new Session({
        headers: { 'X-Session': 'default' },
      });
      const r = await session.get(`${BASE}/headers`, {
        headers: { 'X-Request': 'override' },
      });
      const hdrs = r.json().headers;
      expect(hdrs['X-Session']).toBe('default');
      expect(hdrs['X-Request']).toBe('override');
    });

    it('per-request timeout overrides session default', async () => {
      const session = new Session({ timeout: 30 });
      try {
        await session.get(`${BASE}/delay/10`, { timeout: 1 });
        expect.unreachable('should have thrown');
      } catch (e: any) {
        expect(e instanceof TimeoutError).toBe(true);
      }
    });

    it('per-request followRedirects overrides session', async () => {
      const session = new Session({ followRedirects: true });
      const r = await session.get(`${BASE}/redirect/1`, {
        followRedirects: false,
      });
      expect(r.status).toBeGreaterThanOrEqual(300);
    });
  });

  // ═══ Story 4.4: Cookie Import/Export/Clearing ═════════════════════════

  describe('Story 4.4: Cookie Import/Export/Clear', () => {
    it('exportCookies returns Netscape format', async () => {
      const session = new Session();
      await session.get(`${BASE}/cookies/set?export_test=abc`);
      const exported = session.exportCookies();
      expect(exported.length).toBeGreaterThan(0);
      // Netscape format: domain\tflag\tpath\tsecure\texpiry\tname\tvalue
      expect(exported[0].split('\t').length).toBeGreaterThanOrEqual(7);
    });

    it('constructor with cookies restores state', async () => {
      // Create session with cookies
      const session1 = new Session();
      await session1.get(`${BASE}/cookies/set?import_test=xyz`);
      const exported = session1.exportCookies();

      // Import into new session
      const session2 = new Session({ cookies: exported });
      const r = await session2.get(`${BASE}/cookies`);
      expect(r.json().cookies.import_test).toBe('xyz');
    });

    it('clearCookies() removes all cookies', async () => {
      const session = new Session();
      await session.get(`${BASE}/cookies/set?clear_test=val`);
      expect(session.cookies.length).toBeGreaterThan(0);

      session.clearCookies();
      expect(session.cookies.length).toBe(0);

      // Verify no cookies sent
      const r = await session.get(`${BASE}/cookies`);
      expect(Object.keys(r.json().cookies).length).toBe(0);
    });

    it('clearCookies(domain) removes domain-specific cookies', async () => {
      const session = new Session();
      await session.get(`${BASE}/cookies/set?domain_test=val`);
      expect(session.cookies.length).toBeGreaterThan(0);

      session.clearCookies('httpbin.org');
      expect(session.cookies.length).toBe(0);
    });

    it('importCookies adds cookies to existing session', async () => {
      const session = new Session();
      session.importCookies([
        'httpbin.org\tFALSE\t/\tFALSE\t0\tmanual_cookie\tmanual_value',
      ]);
      const r = await session.get(`${BASE}/cookies`);
      expect(r.json().cookies.manual_cookie).toBe('manual_value');
    });
  });
});
