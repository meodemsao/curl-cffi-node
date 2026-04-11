/**
 * Fingerprint Capture & Verification Tool
 *
 * This script demonstrates how to:
 * 1. Capture TLS + HTTP/2 fingerprint from any browser impersonation
 * 2. Compare fingerprints between browsers
 * 3. Verify your custom fingerprint matches a real browser
 *
 * HOW TO ADD A NEW DEVICE FINGERPRINT:
 *
 * Step 1: Capture from real browser
 *   - Open target browser/device
 *   - Visit https://tls.peet.ws/api/all
 *   - Save the JSON response
 *
 * Step 2: Extract key parameters from the JSON:
 *   - tls.ja3_hash        → JA3 hash to verify against
 *   - tls.ja4             → JA4 hash to verify against
 *   - tls.extensions      → TLS extension names & order
 *   - http2.akamai_fingerprint → H2 settings format
 *   - HTTP/2 SETTINGS frame → Individual setting values
 *   - HTTP/2 HEADERS frame → Pseudo-header order + default headers
 *   - user_agent          → User-Agent string
 *
 * Step 3: Apply via curl-cffi-node low-level options
 *   - See customFingerprint() below for example
 *
 * Step 4: Verify by requesting tls.peet.ws again and comparing hashes
 *
 * Usage:
 *   npx tsx examples/fingerprint-tool.ts
 */

import { Session, Curl, CurlOpt, CurlInfo, BrowserType } from '../lib';

// ── Part 1: Capture fingerprint from an impersonated browser ──
async function captureFingerprint(browser: string) {
  const session = new Session({ impersonate: browser, timeout: 10 });
  const r = await session.get('https://tls.peet.ws/api/all', {
    headers: { 'Accept-Encoding': 'identity' },
  });
  return r.json() as any;
}

// ── Part 2: Display fingerprint in a readable format ──
function displayFingerprint(name: string, fp: any) {
  console.log(`\n╔══ ${name} ${'═'.repeat(Math.max(0, 50 - name.length))}╗`);
  console.log(`║ JA3:      ${fp.tls?.ja3_hash ?? 'N/A'}`);
  console.log(`║ JA4:      ${fp.tls?.ja4 ?? 'N/A'}`);
  console.log(`║ HTTP:     ${fp.http_version}`);
  console.log(`║ Akamai:   ${fp.http2?.akamai_fingerprint ?? 'N/A'}`);
  console.log(`║ UA:       ${fp.user_agent?.slice(0, 65)}...`);
  console.log(`║ Ciphers:  ${fp.tls?.ciphers?.length ?? 0}`);
  console.log(`║ TLS Ext:  ${fp.tls?.extensions?.map((e: any) => e.name?.match(/\((\d+)\)/)?.[1] || e.name?.slice(0, 15)).join(', ')}`);

  // HTTP/2 settings
  const settings = fp.http2?.sent_frames?.find((f: any) => f.frame_type === 'SETTINGS');
  if (settings) {
    console.log(`║ H2 Set:   ${settings.settings?.join('; ')}`);
  }

  // Pseudo headers order
  const headers = fp.http2?.sent_frames?.find((f: any) => f.frame_type === 'HEADERS');
  if (headers) {
    const pseudos = headers.headers
      ?.filter((h: string) => h.startsWith(':'))
      .map((h: string) => h.split(':')[1][0]) // m, a, s, p
      .join('');
    console.log(`║ H2 Order: ${pseudos}`);
  }
  console.log(`╚${'═'.repeat(55)}╝`);

  return {
    ja3: fp.tls?.ja3_hash,
    ja4: fp.tls?.ja4,
    akamai: fp.http2?.akamai_fingerprint,
  };
}

// ── Part 3: Verify a fingerprint matches expected hash ──
function verifyMatch(label: string, actual: string, expected: string) {
  const match = actual === expected;
  console.log(`  ${match ? '✓' : '✗'} ${label}: ${match ? 'MATCH' : `MISMATCH (got ${actual}, want ${expected})`}`);
  return match;
}

async function main() {
  // ── Capture & display fingerprints from all browser families ──
  console.log('═══ Capturing Fingerprints from Impersonated Browsers ═══\n');

  const browsers = [
    'chrome131',
    'safari18_0',
    'safari18_0_ios',
    'firefox133',
  ];

  const fingerprints: Record<string, any> = {};
  for (const browser of browsers) {
    const fp = await captureFingerprint(browser);
    fingerprints[browser] = displayFingerprint(browser, fp);
  }

  // ── Verify impersonation consistency ──
  console.log('\n═══ Verification: Run same browser twice → same fingerprint ═══');
  const fp1 = await captureFingerprint('chrome131');
  const fp2 = await captureFingerprint('chrome131');
  const hash1 = (fp1 as any).tls?.ja4;
  const hash2 = (fp2 as any).tls?.ja4;
  verifyMatch('JA4 consistency', hash1, hash2);

  // ── Show how to compare with real browser fingerprint ──
  console.log('\n═══ How to Verify Against a Real Browser ═══');
  console.log(`
  1. Open real Chrome 131 and visit: https://tls.peet.ws/api/all
  2. Copy the JA3 and JA4 hashes
  3. Compare with our output:
     Our JA4: ${fingerprints.chrome131?.ja4}
  4. If JA4 matches → TLS fingerprint is identical to real Chrome 131

  KEY FINGERPRINT COMPONENTS:
  ┌─────────────────────────┬──────────────────────────────────────┐
  │ Component               │ What it controls                     │
  ├─────────────────────────┼──────────────────────────────────────┤
  │ JA3 hash                │ TLS ClientHello (ciphers, curves,    │
  │                         │ extensions, versions)                │
  │ JA4                     │ Extended JA3 with more precision     │
  │ Akamai H2 fingerprint   │ HTTP/2 SETTINGS + WINDOW_UPDATE +   │
  │                         │ priority + pseudo-header order       │
  │ User-Agent              │ HTTP header (not TLS level)          │
  └─────────────────────────┴──────────────────────────────────────┘

  ADDING A NEW DEVICE:
  ┌────────────────────────────────────────────────────────────────┐
  │ 1. Visit tls.peet.ws/api/all on the real device               │
  │ 2. Save: JA3, JA4, Akamai FP, User-Agent                     │
  │ 3. Use impersonateStr() with a known close browser            │
  │ 4. Override specific options with setopt() to fine-tune        │
  │ 5. Re-check tls.peet.ws → compare JA3/JA4 hashes             │
  └────────────────────────────────────────────────────────────────┘
  `);

  console.log('✅ Done!');
}

main().catch(console.error);
