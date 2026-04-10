import { describe, it, expect } from 'vitest';
import { join } from 'path';

const ROOT = join(import.meta.dirname!, '..', '..');

describe('Story 2.3: Browser Impersonation Presets', () => {
  const mod = require(join(ROOT, 'dist', 'index.js'));
  const { Curl, CurlOpt, BrowserType } = mod;

  describe('BrowserType enum', () => {
    it('BrowserType is exported', () => {
      expect(BrowserType).toBeDefined();
    });

    it('has Chrome variants', () => {
      expect(BrowserType.Chrome99).toBeDefined();
      expect(BrowserType.Chrome100).toBeDefined();
      expect(BrowserType.Chrome110).toBeDefined();
      expect(BrowserType.Chrome116).toBeDefined();
    });

    it('has Edge variants', () => {
      expect(BrowserType.Edge99).toBeDefined();
      expect(BrowserType.Edge101).toBeDefined();
    });

    it('has Safari variants', () => {
      expect(BrowserType.Safari15_3).toBeDefined();
      expect(BrowserType.Safari15_5).toBeDefined();
    });
  });

  describe('impersonate() method', () => {
    it('impersonate Chrome 116 without error', () => {
      const curl = new Curl();
      expect(() => curl.impersonate(BrowserType.Chrome116)).not.toThrow();
    });

    it('impersonate Safari 15.3 without error', () => {
      const curl = new Curl();
      expect(() => curl.impersonate(BrowserType.Safari15_3)).not.toThrow();
    });

    it('impersonate Edge 101 without error', () => {
      const curl = new Curl();
      expect(() => curl.impersonate(BrowserType.Edge101)).not.toThrow();
    });

    it('impersonate with defaultHeaders=false', () => {
      const curl = new Curl();
      expect(() => curl.impersonate(BrowserType.Chrome110, false)).not.toThrow();
    });
  });

  describe('impersonateStr() method', () => {
    it('impersonate with raw string', () => {
      const curl = new Curl();
      expect(() => curl.impersonateStr('chrome110')).not.toThrow();
    });

    it('throws for invalid browser target', () => {
      const curl = new Curl();
      expect(() => curl.impersonateStr('this_does_not_exist')).toThrow(/curl error/);
    });
  });

  describe('Impersonated request via tls.peet.ws', () => {
    it('Chrome116 sends request with TLS fingerprint', () => {
      const curl = new Curl();
      curl.impersonate(BrowserType.Chrome116);
      curl.setoptStr(CurlOpt.Url, 'https://tls.peet.ws/api/all');
      curl.setoptLong(CurlOpt.TimeoutMs, 15000);

      const result = curl.perform();
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body.toString('utf8'));
      expect(body.tls).toBeDefined();
      expect(body.http2).toBeDefined();

      console.log('TLS JA3:', body.tls?.ja3_hash);
      console.log('HTTP/2 Akamai:', body.http2?.akamai_fingerprint_hash);
    });

    it('Safari produces different fingerprint from Chrome', () => {
      const curlChrome = new Curl();
      curlChrome.impersonate(BrowserType.Chrome116);
      curlChrome.setoptStr(CurlOpt.Url, 'https://tls.peet.ws/api/all');
      curlChrome.setoptLong(CurlOpt.TimeoutMs, 15000);
      const r1 = curlChrome.perform();

      const curlSafari = new Curl();
      curlSafari.impersonate(BrowserType.Safari15_5);
      curlSafari.setoptStr(CurlOpt.Url, 'https://tls.peet.ws/api/all');
      curlSafari.setoptLong(CurlOpt.TimeoutMs, 15000);
      const r2 = curlSafari.perform();

      const body1 = JSON.parse(r1.body.toString('utf8'));
      const body2 = JSON.parse(r2.body.toString('utf8'));

      // Different browsers should produce different JA3 hashes
      expect(body1.tls?.ja3_hash).not.toBe(body2.tls?.ja3_hash);
      console.log('Chrome JA3:', body1.tls?.ja3_hash);
      console.log('Safari JA3:', body2.tls?.ja3_hash);
    });
  });
});
