/**
 * Session & Cookies Example
 *
 * Demonstrates session persistence, cookie management,
 * and connection reuse across multiple requests.
 *
 * Usage:
 *   npx tsx examples/session-cookies.ts
 */

import { Session } from '../lib';

async function main() {
  const session = new Session({
    impersonate: 'chrome116',
    timeout: 30,
    followRedirects: true,
  });

  // ── Set cookies via request ──
  console.log('── Setting Cookies ──');
  await session.get('https://httpbin.org/cookies/set?session_id=abc123&user=demo');
  console.log('Cookies after set:', session.cookies);

  // ── Cookies are sent automatically ──
  console.log('\n── Verify Cookies Sent ──');
  const r = await session.get('https://httpbin.org/cookies');
  console.log('Server sees:', (r.json() as any).cookies);

  // ── Export cookies for persistence ──
  console.log('\n── Export Cookies ──');
  const exported = session.exportCookies() as string[];
  console.log('Exported:', exported);

  // ── Import into a new session ──
  console.log('\n── Import into New Session ──');
  const session2 = new Session({
    impersonate: 'chrome110',
    cookies: exported,
  });
  const r2 = await session2.get('https://httpbin.org/cookies');
  console.log('New session sees:', (r2.json() as any).cookies);

  // ── Clear cookies ──
  session.clearCookies();
  console.log('\n── After clearCookies() ──');
  console.log('Cookies:', session.cookies);

  console.log('\n✅ Done!');
}

main().catch(console.error);
