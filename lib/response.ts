/**
 * Headers wrapper with case-insensitive access.
 *
 * Parses raw header string into a Map for efficient lookup.
 */
export class Headers {
  private _map: Map<string, string[]> = new Map();

  constructor(raw: string) {
    for (const line of raw.split('\r\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (!key) continue;
      const existing = this._map.get(key);
      if (existing) {
        existing.push(value);
      } else {
        this._map.set(key, [value]);
      }
    }
  }

  /** Get the first value for a header (case-insensitive). */
  get(name: string): string | null {
    const values = this._map.get(name.toLowerCase());
    return values ? values[0] : null;
  }

  /** Check if a header exists (case-insensitive). */
  has(name: string): boolean {
    return this._map.has(name.toLowerCase());
  }

  /** Get all values for a header. */
  getAll(name: string): string[] {
    return this._map.get(name.toLowerCase()) || [];
  }

  /** Iterate over all headers. */
  forEach(callback: (value: string, key: string) => void): void {
    this._map.forEach((values, key) => {
      for (const v of values) {
        callback(v, key);
      }
    });
  }

  /** Get all header keys. */
  keys(): IterableIterator<string> {
    return this._map.keys();
  }

  /** Get all entries as [key, value] pairs (first value only). */
  entries(): IterableIterator<[string, string]> {
    const entries: [string, string][] = [];
    this._map.forEach((values, key) => {
      entries.push([key, values[0]]);
    });
    return entries[Symbol.iterator]();
  }
}

/**
 * Response timing information in milliseconds.
 */
export interface Timing {
  /** DNS resolution time in ms. */
  dns: number;
  /** TCP connection time in ms. */
  connect: number;
  /** TLS handshake time in ms. */
  tls: number;
  /** Total request time in ms. */
  total: number;
}

/**
 * High-level Response class wrapping the raw PerformResult.
 *
 * Provides convenient access to status, headers, body, and timing.
 *
 * @example
 * ```ts
 * const response = await session.get('https://httpbin.org/get');
 * console.log(response.status);     // 200
 * console.log(response.ok);         // true
 * console.log(response.headers.get('content-type')); // 'application/json'
 * const data = response.json();     // parsed JSON
 * console.log(response.timing);     // { dns: 5.2, connect: 12.1, tls: 45.3, total: 123.4 }
 * ```
 */
export class Response {
  /** HTTP status code (e.g., 200, 404, 500). */
  readonly status: number;

  /** Parsed response headers with case-insensitive access. */
  readonly headers: Headers;

  /** Raw response headers string. */
  readonly rawHeaders: string;

  /** The effective URL after any redirects. */
  readonly url: string;

  /** Raw response body as a Buffer. */
  readonly content: Buffer;

  /** Response timing information in milliseconds. */
  readonly timing: Timing;

  /** Total elapsed time in milliseconds. */
  readonly elapsed: number;

  constructor(raw: {
    body: Buffer;
    headers: string;
    statusCode: number;
    effectiveUrl: string;
    dnsTimeMs: number;
    connectTimeMs: number;
    tlsTimeMs: number;
    totalTimeMs: number;
  }) {
    this.status = raw.statusCode;
    this.rawHeaders = raw.headers;
    this.headers = new Headers(raw.headers);
    this.url = raw.effectiveUrl;
    this.content = raw.body;
    this.elapsed = raw.totalTimeMs;
    this.timing = {
      dns: raw.dnsTimeMs,
      connect: raw.connectTimeMs,
      tls: raw.tlsTimeMs,
      total: raw.totalTimeMs,
    };
  }

  /** Returns true if status is 200-299. */
  get ok(): boolean {
    return this.status >= 200 && this.status < 300;
  }

  /** Returns the response body as a UTF-8 string. */
  text(): string {
    return this.content.toString('utf8');
  }

  /** Parses the response body as JSON. */
  json<T = unknown>(): T {
    try {
      return JSON.parse(this.text()) as T;
    } catch (err) {
      throw new Error(
        `Failed to parse response as JSON: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /** Returns the raw response body as a Buffer. */
  buffer(): Buffer {
    return this.content;
  }

  /** Returns the response body as a Node.js Readable stream. */
  stream(): import('stream').Readable {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Readable } = require('stream') as typeof import('stream');
    return Readable.from(this.content);
  }
}
