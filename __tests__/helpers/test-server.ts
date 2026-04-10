/**
 * Local HTTP test server — httpbin-compatible.
 *
 * Provides deterministic, offline-capable test endpoints that mirror
 * httpbin.org behavior. Eliminates external service dependency for
 * core integration tests.
 *
 * Supported routes:
 *   GET  /get           → echo request info as JSON
 *   POST /post          → echo request info + body as JSON
 *   PUT  /put           → echo request info + body as JSON
 *   DELETE /delete      → echo request info as JSON
 *   PATCH /patch        → echo request info + body as JSON
 *   HEAD /head          → 200 with headers only
 *   GET  /headers       → echo request headers as JSON
 *   GET  /status/:code  → respond with given HTTP status code
 *   GET  /redirect/:n   → chain of N redirects ending at /get
 *   GET  /delay/:sec    → delay response by N seconds
 *   GET  /cookies/set?k=v → set cookies via redirect to /cookies
 *   GET  /cookies       → echo received cookies as JSON
 *   GET  /bytes/:n      → return N random bytes
 */

import http from 'http';

export interface TestServer {
  /** Base URL including port, e.g. http://127.0.0.1:12345 */
  url: string;
  /** Port number the server is listening on. */
  port: number;
  /** Gracefully shut down the server. */
  close: () => Promise<void>;
}

export async function createTestServer(): Promise<TestServer> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host || 'localhost'}`);
    const route = url.pathname;
    const method = req.method || 'GET';

    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        routeRequest(req, res, route, method, url, body);
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      const port = addr.port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        port,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

// ─── Route Handler ───────────────────────────────────────────────────────────

function routeRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  route: string,
  method: string,
  url: URL,
  body: string,
): void {
  // Echo endpoints — mirror httpbin behavior
  if (route === '/get' || route === '/post' || route === '/put' || route === '/delete' || route === '/patch') {
    const expectedMethod = route.slice(1).toUpperCase();
    if (method !== expectedMethod) {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Method ${method} not allowed for ${route}` }));
      return;
    }
    jsonResponse(res, 200, {
      url: `${url.origin}${url.pathname}${url.search}`,
      method,
      headers: sanitizeHeaders(req.headers),
      args: Object.fromEntries(url.searchParams),
      data: body || '',
    });
    return;
  }

  // HEAD
  if (route === '/head') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Test': 'head-response',
    });
    res.end();
    return;
  }

  // Headers echo
  if (route === '/headers') {
    jsonResponse(res, 200, { headers: sanitizeHeaders(req.headers) });
    return;
  }

  // Status code
  const statusMatch = route.match(/^\/status\/(\d+)$/);
  if (statusMatch) {
    const code = parseInt(statusMatch[1], 10);
    res.writeHead(code, { 'Content-Type': 'text/plain' });
    res.end(`Status: ${code}`);
    return;
  }

  // Redirect chain
  const redirectMatch = route.match(/^\/redirect\/(\d+)$/);
  if (redirectMatch) {
    const n = parseInt(redirectMatch[1], 10);
    if (n > 0) {
      res.writeHead(302, { Location: `/redirect/${n - 1}` });
      res.end();
    } else {
      // Final redirect destination
      jsonResponse(res, 200, {
        url: `${url.origin}/get`,
        redirected: true,
      });
    }
    return;
  }

  // Delay
  const delayMatch = route.match(/^\/delay\/(\d+)$/);
  if (delayMatch) {
    const seconds = parseInt(delayMatch[1], 10);
    setTimeout(() => {
      jsonResponse(res, 200, { delayed: seconds });
    }, seconds * 1000);
    return;
  }

  // Set cookies (redirect to /cookies)
  if (route === '/cookies/set') {
    const setCookies: string[] = [];
    url.searchParams.forEach((value, key) => {
      setCookies.push(`${key}=${value}; Path=/`);
    });
    res.writeHead(302, {
      'Set-Cookie': setCookies,
      Location: '/cookies',
    });
    res.end();
    return;
  }

  // Echo cookies
  if (route === '/cookies') {
    const cookies = parseCookieHeader(req.headers.cookie || '');
    jsonResponse(res, 200, { cookies });
    return;
  }

  // Random bytes
  const bytesMatch = route.match(/^\/bytes\/(\d+)$/);
  if (bytesMatch) {
    const n = parseInt(bytesMatch[1], 10);
    const buf = Buffer.alloc(n);
    for (let i = 0; i < n; i++) {
      buf[i] = Math.floor(Math.random() * 256);
    }
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(n),
    });
    res.end(buf);
    return;
  }

  // 404 fallback
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found', route }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(res: http.ServerResponse, status: number, data: unknown): void {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': String(Buffer.byteLength(payload)),
  });
  res.end(payload);
}

function sanitizeHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    // Capitalize header names like httpbin does (first letter each word)
    const normalizedKey = key
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('-');
    result[normalizedKey] = Array.isArray(value) ? value.join(', ') : (value || '');
  }
  return result;
}

function parseCookieHeader(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieStr) return cookies;

  for (const pair of cookieStr.split(';')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (key) cookies[key] = value;
  }
  return cookies;
}
