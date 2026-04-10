/**
 * Basic Request Example
 *
 * Demonstrates simple GET and POST requests with browser impersonation.
 *
 * Usage:
 *   npx tsx examples/basic-request.ts
 */

import { Session } from '../lib';

async function main() {
  // Create a session impersonating Chrome 116
  const session = new Session({ impersonate: 'chrome116' });

  // ── GET Request ──
  console.log('── GET Request ──');
  const r1 = await session.get('https://httpbin.org/get', {
    params: { hello: 'world', from: 'curl-cffi-node' },
  });
  console.log('Status:', r1.status);
  console.log('URL:', r1.url);
  console.log('Body:', JSON.stringify((r1.json() as any).args, null, 2));

  // ── POST with JSON ──
  console.log('\n── POST with JSON ──');
  const r2 = await session.post('https://httpbin.org/post', {
    data: { username: 'demo', library: 'curl-cffi-node' },
  });
  console.log('Status:', r2.status);
  console.log('Sent JSON:', (r2.json() as any).json);

  // ── Response Timing ──
  console.log('\n── Response Timing ──');
  console.log(`Total: ${r2.elapsed.toFixed(1)}ms`);

  console.log('\n✅ Done!');
}

main().catch(console.error);
