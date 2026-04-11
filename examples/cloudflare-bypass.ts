/**
 * Cloudflare Protected Sites Example
 *
 * Demonstrates browser TLS fingerprint impersonation against
 * Cloudflare-protected websites and the Cloudflare trace endpoint.
 *
 * Usage:
 *   npx tsx examples/cloudflare-bypass.ts
 */

import { Session } from '../lib';

async function main() {
  // ── Cloudflare Trace — verify TLS & HTTP/2 fingerprint ──
  console.log('── Cloudflare Trace ──');
  const chrome = new Session({
    impersonate: 'chrome131',
    timeout: 15,
    followRedirects: true,
  });

  const traceResp = await chrome.get('https://1.1.1.1/cdn-cgi/trace', {
    headers: { 'Accept-Encoding': 'identity' },
  });
  const trace = Object.fromEntries(
    traceResp
      .text()
      .trim()
      .split('\n')
      .map((line) => {
        const [k, ...v] = line.split('=');
        return [k, v.join('=')];
      })
  );
  console.log(`  IP:         ${trace.ip}`);
  console.log(`  Location:   ${trace.loc} (${trace.colo})`);
  console.log(`  TLS:        ${trace.tls}`);
  console.log(`  HTTP:       ${trace.http}`);
  console.log(`  User-Agent: ${trace.uag?.slice(0, 70)}...`);

  // ── Access Cloudflare-protected sites ──
  console.log('\n── Cloudflare-Protected Sites ──');
  const targets = [
    { url: 'https://www.cloudflare.com', label: 'Cloudflare' },
    { url: 'https://speed.cloudflare.com', label: 'Speed Test' },
    { url: 'https://blog.cloudflare.com', label: 'CF Blog' },
    { url: 'https://developers.cloudflare.com', label: 'CF Docs' },
  ];

  for (const { url, label } of targets) {
    const r = await chrome.get(url, {
      headers: { 'Accept-Encoding': 'identity' },
    });
    const text = r.text();
    const blocked =
      r.status === 403 ||
      text.includes('Just a moment') ||
      text.includes('challenge-platform');
    const title = text.match(/<title>(.*?)<\/title>/)?.[1]?.slice(0, 50) ?? 'N/A';

    console.log(`  ${blocked ? '✗' : '✓'} [${r.status}] ${label}: ${title}`);
  }

  // ── Compare impersonation targets ──
  console.log('\n── Compare Browser Fingerprints via CF Trace ──');
  const browsers = ['chrome116', 'chrome131', 'safari17_0'] as const;

  for (const browser of browsers) {
    const s = new Session({ impersonate: browser, timeout: 10 });
    const r = await s.get('https://1.1.1.1/cdn-cgi/trace', {
      headers: { 'Accept-Encoding': 'identity' },
    });
    const data = Object.fromEntries(
      r.text()
        .trim()
        .split('\n')
        .map((line) => {
          const [k, ...v] = line.split('=');
          return [k, v.join('=')];
        })
    );
    console.log(`  ${browser.padEnd(12)} → TLS: ${data.tls}  HTTP: ${data.http}  KEX: ${data.kex ?? 'N/A'}`);
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
