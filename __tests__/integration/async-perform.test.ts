/**
 * Story 2.4: Async Perform via Thread Pool
 *
 * Tests async curl.performAsync() including non-blocking behavior,
 * concurrency, and error handling. Uses local test server where possible
 * since performAsync() does NOT block the event loop.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Curl, CurlOpt, BrowserType, TIMEOUT_MS, SLOW_TIMEOUT_MS, EXTERNAL } from '../helpers/fixtures';
import { createTestServer, TestServer } from '../helpers/test-server';

let server: TestServer;

beforeAll(async () => {
  server = await createTestServer();
});

afterAll(async () => {
  await server.close();
});

describe('Story 2.4: Async Perform via Thread Pool', () => {
  describe('performAsync() - Basic', () => {
    it('performs an async GET request', async () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${server.url}/get`);
      curl.setoptLong(CurlOpt.TimeoutMs, TIMEOUT_MS);

      const result = await curl.performAsync();

      expect(result).toBeDefined();
      expect(result.statusCode).toBe(200);
      expect(result.body).toBeInstanceOf(Buffer);
      expect(result.body.length).toBeGreaterThan(0);
      expect(result.headers).toBeDefined();
      expect(result.effectiveUrl).toContain(server.url);
    });

    it('response body is valid JSON', async () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${server.url}/get`);
      curl.setoptLong(CurlOpt.TimeoutMs, TIMEOUT_MS);

      const result = await curl.performAsync();
      const body = JSON.parse(result.body.toString('utf8'));
      expect(body.url).toContain('/get');
    });

    it('custom headers are sent', async () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${server.url}/headers`);
      curl.setoptLong(CurlOpt.TimeoutMs, TIMEOUT_MS);
      curl.setoptList(CurlOpt.HttpHeader, ['X-Async-Test: curl-cffi-node']);

      const result = await curl.performAsync();
      const body = JSON.parse(result.body.toString('utf8'));
      expect(body.headers['X-Async-Test']).toBe('curl-cffi-node');
    });
  });

  describe('performAsync() - Error handling', () => {
    it('rejects on timeout', async () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${server.url}/delay/10`);
      curl.setoptLong(CurlOpt.TimeoutMs, 500);

      await expect(curl.performAsync()).rejects.toThrow(/curl error/);
    });

    it('rejects on invalid URL', async () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, 'https://this-domain-definitely-does-not-exist-xyzzy.test');
      curl.setoptLong(CurlOpt.TimeoutMs, TIMEOUT_MS);

      await expect(curl.performAsync()).rejects.toThrow(/curl error/);
    });
  });

  describe('performAsync() - Non-blocking', () => {
    it('does not block the event loop', async () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${server.url}/delay/1`);
      curl.setoptLong(CurlOpt.TimeoutMs, TIMEOUT_MS);

      let timerFired = false;
      const timer = setTimeout(() => { timerFired = true; }, 50);

      await curl.performAsync();
      clearTimeout(timer);

      expect(timerFired).toBe(true);
    });
  });

  describe('performAsync() - Concurrency', () => {
    it('executes multiple async requests in parallel', async () => {
      const start = Date.now();
      const N = 5;

      const promises = [];
      for (let i = 0; i < N; i++) {
        const curl = new Curl();
        curl.setoptStr(CurlOpt.Url, `${server.url}/get`);
        curl.setoptLong(CurlOpt.TimeoutMs, TIMEOUT_MS);
        promises.push(curl.performAsync());
      }

      const results = await Promise.all(promises);
      const elapsed = Date.now() - start;

      expect(results).toHaveLength(N);
      expect(results.every((r: any) => r.statusCode === 200)).toBe(true);
      console.log(`  ${N} parallel requests in ${elapsed}ms`);
    });
  });

  describe('performAsync() - With impersonation (e2e)', () => {
    it('async request with Chrome116 impersonation', async () => {
      const curl = new Curl();
      curl.impersonate(BrowserType.Chrome116);
      curl.setoptStr(CurlOpt.Url, EXTERNAL.TLS_CHECK);
      curl.setoptLong(CurlOpt.TimeoutMs, SLOW_TIMEOUT_MS);

      const result = await curl.performAsync();
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body.toString('utf8'));
      expect(body.tls).toBeDefined();
      expect(body.tls.ja3_hash).toBeDefined();
      console.log('  Async Chrome116 JA3:', body.tls.ja3_hash);
    });
  });

  describe('performAsync() - Redirects', () => {
    it('follows redirects asynchronously', async () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${server.url}/redirect/1`);
      curl.setoptLong(CurlOpt.TimeoutMs, TIMEOUT_MS);
      curl.setoptLong(CurlOpt.FollowLocation, 1);
      curl.setoptLong(CurlOpt.MaxRedirs, 5);

      const result = await curl.performAsync();
      expect(result.statusCode).toBe(200);
    });
  });
});
