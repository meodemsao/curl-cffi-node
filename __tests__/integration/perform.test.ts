/**
 * Story 2.2: Synchronous Perform & Response Extraction
 *
 * Tests the low-level Curl handle perform() method and response parsing.
 *
 * NOTE: perform() is synchronous and blocks the Node.js event loop.
 * This means we CANNOT use a local Node HTTP server (it would deadlock).
 * These tests require external services (httpbin.org).
 */

import { describe, it, expect } from 'vitest';
import { Curl, CurlOpt, CurlInfo, TIMEOUT_MS, EXTERNAL, SLOW_TIMEOUT_MS } from '../helpers/fixtures';

describe('Story 2.2: Synchronous Perform & Response Extraction', () => {
  describe('perform() - GET requests', () => {
    it('performs a basic GET request', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${EXTERNAL.HTTPBIN}/get`);
      curl.setoptLong(CurlOpt.TimeoutMs, SLOW_TIMEOUT_MS);

      const result = curl.perform();

      expect(result).toBeDefined();
      expect(result.statusCode).toBe(200);
      expect(result.body).toBeInstanceOf(Buffer);
      expect(result.body.length).toBeGreaterThan(0);
      expect(result.headers).toBeDefined();
      expect(typeof result.headers).toBe('string');
      expect(result.effectiveUrl).toContain('httpbin.org');
    });

    it('response body is valid JSON from httpbin', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${EXTERNAL.HTTPBIN}/get`);
      curl.setoptLong(CurlOpt.TimeoutMs, SLOW_TIMEOUT_MS);

      const result = curl.perform();
      const body = JSON.parse(result.body.toString('utf8'));
      expect(body.url).toBe('https://httpbin.org/get');
    });

    it('custom headers are sent', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${EXTERNAL.HTTPBIN}/headers`);
      curl.setoptLong(CurlOpt.TimeoutMs, SLOW_TIMEOUT_MS);
      curl.setoptList(CurlOpt.HttpHeader, [
        'X-Test-Header: curl-cffi-node',
        'Accept: application/json',
      ]);

      const result = curl.perform();
      const body = JSON.parse(result.body.toString('utf8'));
      expect(body.headers['X-Test-Header']).toBe('curl-cffi-node');
    });
  });

  describe('perform() - Response headers', () => {
    it('returns response headers as string', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${EXTERNAL.HTTPBIN}/get`);
      curl.setoptLong(CurlOpt.TimeoutMs, SLOW_TIMEOUT_MS);

      const result = curl.perform();
      expect(result.headers.toLowerCase()).toContain('content-type');
    });

    it('headers contain HTTP status line', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${EXTERNAL.HTTPBIN}/get`);
      curl.setoptLong(CurlOpt.TimeoutMs, SLOW_TIMEOUT_MS);

      const result = curl.perform();
      expect(result.headers).toContain('200');
    });
  });

  describe('perform() - Status codes', () => {
    it('returns 404 for not found', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${EXTERNAL.HTTPBIN}/status/404`);
      curl.setoptLong(CurlOpt.TimeoutMs, SLOW_TIMEOUT_MS);

      const result = curl.perform();
      expect(result.statusCode).toBe(404);
    });

    it('returns 302 without follow redirects', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${EXTERNAL.HTTPBIN}/redirect/1`);
      curl.setoptLong(CurlOpt.TimeoutMs, SLOW_TIMEOUT_MS);
      curl.setoptLong(CurlOpt.FollowLocation, 0);

      const result = curl.perform();
      expect(result.statusCode).toBe(302);
    });

    it('follows redirects when enabled', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${EXTERNAL.HTTPBIN}/redirect/1`);
      curl.setoptLong(CurlOpt.TimeoutMs, SLOW_TIMEOUT_MS);
      curl.setoptLong(CurlOpt.FollowLocation, 1);
      curl.setoptLong(CurlOpt.MaxRedirs, 5);

      const result = curl.perform();
      expect(result.statusCode).toBe(200);
      expect(result.effectiveUrl).toContain('httpbin.org/get');
    });
  });

  describe('perform() - Error handling', () => {
    it('throws on connection timeout', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${EXTERNAL.HTTPBIN}/delay/10`);
      curl.setoptLong(CurlOpt.TimeoutMs, 1000);

      expect(() => curl.perform()).toThrow(/curl error/);
    });

    it('throws on invalid URL', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, 'https://this-domain-definitely-does-not-exist-xyzzy.test');
      curl.setoptLong(CurlOpt.TimeoutMs, TIMEOUT_MS);

      expect(() => curl.perform()).toThrow(/curl error/);
    });
  });

  describe('getinfo() after perform', () => {
    it('ResponseCode returns HTTP status', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${EXTERNAL.HTTPBIN}/get`);
      curl.setoptLong(CurlOpt.TimeoutMs, SLOW_TIMEOUT_MS);
      curl.perform();

      const code = curl.getinfo(CurlInfo.ResponseCode);
      expect(code).toBe(200);
    });

    it('TotalTime returns positive number', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${EXTERNAL.HTTPBIN}/get`);
      curl.setoptLong(CurlOpt.TimeoutMs, SLOW_TIMEOUT_MS);
      curl.perform();

      const time = curl.getinfo(CurlInfo.TotalTime);
      expect(typeof time).toBe('number');
      expect(time as number).toBeGreaterThan(0);
    });

    it('EffectiveUrl returns the final URL', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${EXTERNAL.HTTPBIN}/get`);
      curl.setoptLong(CurlOpt.TimeoutMs, SLOW_TIMEOUT_MS);
      curl.perform();

      const url = curl.getinfo(CurlInfo.EffectiveUrl);
      expect(url).toBe('https://httpbin.org/get');
    });
  });

  describe('Handle reuse', () => {
    it('handle can be reused after reset', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, `${EXTERNAL.HTTPBIN}/get`);
      curl.setoptLong(CurlOpt.TimeoutMs, SLOW_TIMEOUT_MS);
      const r1 = curl.perform();
      expect(r1.statusCode).toBe(200);

      curl.reset();
      curl.setoptStr(CurlOpt.Url, `${EXTERNAL.HTTPBIN}/status/201`);
      curl.setoptLong(CurlOpt.TimeoutMs, SLOW_TIMEOUT_MS);
      const r2 = curl.perform();
      expect(r2.statusCode).toBe(201);
    });
  });
});
