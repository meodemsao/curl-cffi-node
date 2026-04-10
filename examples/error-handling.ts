/**
 * Error Handling Example
 *
 * Demonstrates the typed error hierarchy for graceful
 * error handling in production applications.
 *
 * Usage:
 *   npx tsx examples/error-handling.ts
 */

import {
  Session,
  TimeoutError,
  ConnectionError,
  TLSError,
  CurlError,
} from '../lib';

async function main() {
  const session = new Session({ impersonate: 'chrome116' });

  // ── Timeout Error ──
  console.log('── Timeout Error ──');
  try {
    await session.get('https://httpbin.org/delay/10', { timeout: 2 });
  } catch (err) {
    if (err instanceof TimeoutError) {
      console.log('✓ Caught TimeoutError:', err.message);
    }
  }

  // ── Connection Error ──
  console.log('\n── Connection Error ──');
  try {
    await session.get('https://localhost:1', { timeout: 3 });
  } catch (err) {
    if (err instanceof ConnectionError) {
      console.log('✓ Caught ConnectionError:', err.message);
    }
  }

  // ── TLS Error (bad cert) ──
  console.log('\n── TLS Error ──');
  try {
    await session.get('https://expired.badssl.com/', { timeout: 10 });
  } catch (err) {
    if (err instanceof TLSError) {
      console.log('✓ Caught TLSError:', err.message);
    } else if (err instanceof CurlError) {
      console.log('✓ Caught CurlError (code:', err.code + '):', err.message);
    }
  }

  // ── Generic Error Handling ──
  console.log('\n── Generic CurlError catch ──');
  try {
    await session.get('https://this-domain-does-not-exist-xyz.com', { timeout: 5 });
  } catch (err) {
    if (err instanceof CurlError) {
      console.log('✓ Caught CurlError');
      console.log('  Code:', err.code);
      console.log('  Message:', err.curlMessage);
    }
  }

  console.log('\n✅ All errors handled gracefully!');
}

main().catch(console.error);
