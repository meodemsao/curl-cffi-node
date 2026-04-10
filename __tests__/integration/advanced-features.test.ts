import { describe, it, expect } from 'vitest';
import { join } from 'path';

const ROOT = join(import.meta.dirname!, '..', '..');

describe('Epic 5: Advanced Features', () => {
  const mod = require(join(ROOT, 'dist', 'index.js'));
  const { Curl, CurlOpt, Session } = mod;

  // ═══ Story 5.1: Custom JA3 Fingerprint Strings ═══════════════════════

  describe('Story 5.1: Custom JA3 Fingerprint', () => {
    it('can set SSL cipher list', async () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, 'https://tls.peet.ws/api/all');
      curl.setoptStr(CurlOpt.SslCipherList, 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256');
      curl.setoptLong(CurlOpt.TimeoutMs, 10000);
      curl.setoptLong(CurlOpt.FollowLocation, 1);
      const result = curl.perform();
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body.toString());
      expect(body.tls.ciphers).toBeDefined();
    });

    it('TLS 1.3 cipher override throws on unsupported build', async () => {
      // BoringSSL (used by curl-impersonate) doesn't support CURLOPT_TLS13_CIPHERS
      // This test verifies we get a proper error rather than a crash
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, 'https://tls.peet.ws/api/all');
      curl.setoptLong(CurlOpt.TimeoutMs, 10000);
      expect(() => {
        curl.setoptStr(CurlOpt.Tls13Ciphers, 'TLS_AES_128_GCM_SHA256');
      }).toThrow(/not found built-in/);
    });

    it('can set elliptic curves', async () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, 'https://tls.peet.ws/api/all');
      curl.setoptStr(CurlOpt.SslEcCurves, 'X25519:P-256:P-384');
      curl.setoptLong(CurlOpt.TimeoutMs, 10000);
      curl.setoptLong(CurlOpt.FollowLocation, 1);
      const result = curl.perform();
      expect(result.statusCode).toBe(200);
    });

    it('custom TLS settings change JA3 fingerprint', async () => {
      // Default request
      const curl1 = new Curl();
      curl1.setoptStr(CurlOpt.Url, 'https://tls.peet.ws/api/all');
      curl1.setoptLong(CurlOpt.TimeoutMs, 10000);
      curl1.setoptLong(CurlOpt.FollowLocation, 1);
      const r1 = curl1.perform();
      const ja3_default = JSON.parse(r1.body.toString()).tls.ja3_hash;

      // Custom cipher request
      const curl2 = new Curl();
      curl2.setoptStr(CurlOpt.Url, 'https://tls.peet.ws/api/all');
      curl2.setoptStr(CurlOpt.SslCipherList, 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384');
      curl2.setoptStr(CurlOpt.SslEcCurves, 'P-256');
      curl2.setoptLong(CurlOpt.TimeoutMs, 10000);
      curl2.setoptLong(CurlOpt.FollowLocation, 1);
      const r2 = curl2.perform();
      const ja3_custom = JSON.parse(r2.body.toString()).tls.ja3_hash;

      // JA3 should be different
      expect(ja3_default).toBeDefined();
      expect(ja3_custom).toBeDefined();
      expect(ja3_default).not.toBe(ja3_custom);
      console.log(`  Default JA3: ${ja3_default}`);
      console.log(`  Custom JA3:  ${ja3_custom}`);
    });
  });

  // ═══ Story 5.2: Custom Akamai HTTP/2 Fingerprint ═════════════════════

  describe('Story 5.2: Custom Akamai Fingerprint', () => {
    it('can set HTTP/2 settings', async () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, 'https://tls.peet.ws/api/all');
      curl.setoptLong(CurlOpt.HttpVersion, 4); // CURL_HTTP_VERSION_2_0
      curl.setoptStr(CurlOpt.Http2Settings, '1:65536;2:0;3:1000;4:6291456;6:262144');
      curl.setoptStr(CurlOpt.Http2PseudoHeadersOrder, 'masp');
      curl.setoptLong(CurlOpt.Http2WindowUpdate, 15663105);
      curl.setoptLong(CurlOpt.StreamWeight, 256);
      curl.setoptLong(CurlOpt.TimeoutMs, 10000);
      curl.setoptLong(CurlOpt.FollowLocation, 1);
      const result = curl.perform();
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body.toString());
      // Verify HTTP/2 was used
      expect(body.http_version).toBe('h2');
      console.log(`  Akamai fingerprint: ${body.http2?.akamai_fingerprint}`);
    });

    it('combined with impersonation override', async () => {
      const curl = new Curl();
      curl.impersonateStr('chrome116', true);
      curl.setoptStr(CurlOpt.Url, 'https://tls.peet.ws/api/all');
      // Override HTTP/2 settings on top of impersonation
      curl.setoptStr(CurlOpt.Http2Settings, '1:65536;3:1000;4:6291456;6:262144');
      curl.setoptLong(CurlOpt.TimeoutMs, 10000);
      curl.setoptLong(CurlOpt.FollowLocation, 1);
      const result = curl.perform();
      expect(result.statusCode).toBe(200);
    });
  });

  // ═══ Story 5.3: Streaming Response ═══════════════════════════════════

  describe('Story 5.3: Streaming Response', () => {
    it('response.stream() returns a Readable', async () => {
      const session = new Session();
      const r = await session.get('https://httpbin.org/get');
      const stream = r.stream();
      expect(stream).toBeDefined();
      expect(typeof stream.read).toBe('function');
      expect(typeof stream.on).toBe('function');
    });

    it('stream can be consumed', async () => {
      const session = new Session();
      const r = await session.get('https://httpbin.org/get');
      const stream = r.stream();

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const combined = Buffer.concat(chunks);
      expect(combined.length).toBeGreaterThan(0);
      const data = JSON.parse(combined.toString());
      expect(data.url).toBe('https://httpbin.org/get');
    });

    it('stream data matches buffer data', async () => {
      const session = new Session();
      const r = await session.get('https://httpbin.org/get');

      // Buffer path
      const bufferContent = r.buffer();

      // Stream path
      const stream = r.stream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const streamContent = Buffer.concat(chunks);

      expect(streamContent.equals(bufferContent)).toBe(true);
    });
  });
});
