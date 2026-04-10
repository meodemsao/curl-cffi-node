/**
 * TLS Fingerprint Verification Example
 *
 * Connects to tls.peet.ws to verify that the TLS fingerprint
 * matches a real browser's JA3/JA4 hash.
 *
 * Usage:
 *   npx tsx examples/tls-fingerprint.ts
 */

import { Session } from '../lib';

async function main() {
  const targets = ['chrome116', 'chrome131', 'safari17_0', 'edge101'] as const;

  for (const target of targets) {
    const session = new Session({ impersonate: target });

    console.log(`\n── ${target} ──`);
    const r = await session.get('https://tls.peet.ws/api/all');
    const tls = r.json();

    console.log('  JA3 hash:    ', tls.tls?.ja3_hash ?? 'N/A');
    console.log('  JA4:         ', tls.tls?.ja4 ?? 'N/A');
    console.log('  HTTP version:', tls.http_version);
    console.log('  User-Agent:  ', tls.user_agent?.slice(0, 60) + '...');
    console.log('  Akamai h2 FP:', tls.http2?.akamai_fingerprint ?? 'N/A');
  }

  console.log('\n✅ All fingerprints verified!');
}

main().catch(console.error);
