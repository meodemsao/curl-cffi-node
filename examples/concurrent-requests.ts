/**
 * Concurrent Async Requests Example
 *
 * Demonstrates non-blocking async requests using performAsync()
 * with Promise.all for parallel execution.
 *
 * Usage:
 *   npx tsx examples/concurrent-requests.ts
 */

import { Session } from '../lib';

async function main() {
  const session = new Session({ impersonate: 'chrome116' });

  const urls = [
    'https://httpbin.org/delay/1',
    'https://httpbin.org/delay/1',
    'https://httpbin.org/delay/1',
    'https://httpbin.org/delay/1',
    'https://httpbin.org/delay/1',
  ];

  console.log(`── Fetching ${urls.length} URLs concurrently ──`);
  const start = Date.now();

  const results = await Promise.all(
    urls.map((url, i) =>
      session.get(url).then((r) => {
        console.log(`  [${i + 1}] ${r.status} — ${r.elapsed.toFixed(0)}ms`);
        return r;
      })
    )
  );

  const total = Date.now() - start;
  console.log(`\n── Results ──`);
  console.log(`  Total requests:  ${results.length}`);
  console.log(`  All succeeded:   ${results.every((r) => r.ok)}`);
  console.log(`  Wall-clock time: ${total}ms (vs ${urls.length}s sequential)`);

  console.log('\n✅ Done!');
}

main().catch(console.error);
