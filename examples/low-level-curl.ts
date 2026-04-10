/**
 * Low-Level Curl Handle Example
 *
 * Demonstrates direct access to the curl handle for advanced
 * use cases: custom TLS settings, HTTP/2 tuning, etc.
 *
 * Usage:
 *   npx tsx examples/low-level-curl.ts
 */

import { Curl, CurlOpt, CurlInfo, BrowserType } from '../lib';

async function main() {
  // ── Basic usage with impersonation ──
  console.log('── Curl Handle with Impersonation ──');
  const curl = new Curl();
  curl.impersonate(BrowserType.Chrome116);
  curl.setoptStr(CurlOpt.Url, 'https://httpbin.org/get');
  curl.setoptLong(CurlOpt.TimeoutMs, 10000);
  curl.setoptList(CurlOpt.HttpHeader, [
    'Accept: application/json',
    'X-Custom-Header: curl-cffi-node-example',
  ]);

  const result = await curl.performAsync();
  console.log('Status:', result.statusCode);
  console.log('Body preview:', result.body.toString().slice(0, 200));

  // ── Get detailed info ──
  console.log('\n── Connection Info ──');
  console.log('Effective URL:', curl.getinfo(CurlInfo.EffectiveUrl));
  console.log('Total time:   ', curl.getinfo(CurlInfo.TotalTime), 's');
  console.log('Primary IP:   ', curl.getinfo(CurlInfo.PrimaryIp));

  // ── Reuse handle ──
  console.log('\n── Reuse Handle ──');
  curl.reset();
  curl.impersonateStr('safari17_0');
  curl.setoptStr(CurlOpt.Url, 'https://httpbin.org/user-agent');
  curl.setoptLong(CurlOpt.TimeoutMs, 10000);

  const result2 = await curl.performAsync();
  console.log('Safari UA:', JSON.parse(result2.body.toString())['user-agent']);

  console.log('\n✅ Done!');
}

main().catch(console.error);
