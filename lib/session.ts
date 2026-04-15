/**
 * High-level Session class for making HTTP requests with browser impersonation.
 *
 * Uses a persistent curl handle for cookie persistence and connection reuse.
 *
 * @example
 * ```ts
 * const session = new Session({ impersonate: 'chrome116' });
 * const response = await session.get('https://httpbin.org/get');
 * console.log(response.json());
 * ```
 */

import { nativeBinding } from './binding.js';
import { CurlOpt } from './enums.js';
import { Response } from './response.js';
import { parseCurlError } from './errors.js';
import type { CurlHandle } from './types.js';

/** Options for creating a Session. */
export interface SessionOptions {
  /** Browser to impersonate (e.g., 'chrome116', 'safari15_5'). */
  impersonate?: string;
  /** Default headers for all requests. */
  headers?: Record<string, string>;
  /** Default timeout in seconds. */
  timeout?: number;
  /** Whether to follow redirects (default: true). */
  followRedirects?: boolean;
  /** Maximum number of redirects (default: 30). */
  maxRedirects?: number;
  /** Proxy URL (e.g., 'http://host:port', 'socks5://user:pass@host:port'). */
  proxy?: string;
  /** Whether to verify SSL certificates (default: true). */
  verify?: boolean;
  /** Whether to apply default browser headers (default: true). */
  defaultHeaders?: boolean;
  /** Pre-existing cookies in Netscape format to restore. */
  cookies?: string[];
}

/** Options for individual requests. */
export interface RequestOptions {
  /** Custom headers for this request. */
  headers?: Record<string, string>;
  /** Request body as string, Buffer, or JSON object. */
  data?: string | Buffer | Record<string, unknown>;
  /** URL query parameters. */
  params?: Record<string, string | number | boolean>;
  /** Timeout in seconds (overrides session default). */
  timeout?: number;
  /** Whether to follow redirects (overrides session default). */
  followRedirects?: boolean;
  /** Maximum redirects (overrides session default). */
  maxRedirects?: number;
  /** Proxy URL (overrides session default). */
  proxy?: string;
  /** Whether to verify SSL (overrides session default). */
  verify?: boolean;
  /** Browser to impersonate (overrides session default). */
  impersonate?: string;
}

export class Session {
  private _options: Required<Omit<SessionOptions, 'impersonate' | 'headers' | 'proxy' | 'cookies'>> & {
    impersonate?: string;
    headers?: Record<string, string>;
    proxy?: string;
  };
  /** Persistent handle for connection reuse and cookie persistence. */
  private _handle: CurlHandle;

  constructor(options: SessionOptions = {}) {
    this._options = {
      followRedirects: true,
      maxRedirects: 30,
      verify: true,
      defaultHeaders: true,
      timeout: 0,
      ...options,
    };

    // Create the persistent handle
    this._handle = new nativeBinding.Curl();

    // Enable cookie engine
    this._handle.enableCookies();

    // Set impersonation once on the persistent handle
    if (this._options.impersonate) {
      this._handle.impersonateStr(
        this._options.impersonate,
        this._options.defaultHeaders,
      );
    }

    // Import pre-existing cookies
    if (options.cookies) {
      for (const line of options.cookies) {
        this._handle.addCookie(line);
      }
    }
  }

  // ─── HTTP Methods ─────────────────────────────────────────────────────

  async get(url: string, options?: RequestOptions): Promise<Response> {
    return this._request('GET', url, options);
  }

  async post(url: string, options?: RequestOptions): Promise<Response> {
    return this._request('POST', url, options);
  }

  async put(url: string, options?: RequestOptions): Promise<Response> {
    return this._request('PUT', url, options);
  }

  async delete(url: string, options?: RequestOptions): Promise<Response> {
    return this._request('DELETE', url, options);
  }

  async head(url: string, options?: RequestOptions): Promise<Response> {
    return this._request('HEAD', url, options);
  }

  async patch(url: string, options?: RequestOptions): Promise<Response> {
    return this._request('PATCH', url, options);
  }

  async options(url: string, options?: RequestOptions): Promise<Response> {
    return this._request('OPTIONS', url, options);
  }

  // ─── Cookie Management ────────────────────────────────────────────────

  /** Get all cookies in Netscape format. */
  get cookies(): string[] {
    return this._handle.getCookies();
  }

  /** Export cookies as serialized Netscape-format strings (for persistence). */
  exportCookies(): string[] {
    return this._handle.getCookies();
  }

  /** Import cookies from Netscape-format strings. */
  importCookies(cookies: string[]): void {
    for (const line of cookies) {
      this._handle.addCookie(line);
    }
  }

  /** Clear all cookies. */
  clearCookies(): void;
  /** Clear cookies for a specific domain. */
  clearCookies(domain: string): void;
  clearCookies(domain?: string): void {
    if (domain) {
      // Filter by domain: get all, clear all, re-add non-matching
      const all = this._handle.getCookies();
      this._handle.clearCookies();
      for (const line of all) {
        // Netscape format: domain \t ... — first field is domain
        const parts = line.split('\t');
        if (parts[0] !== domain && parts[0] !== `.${domain}`) {
          this._handle.addCookie(line);
        }
      }
    } else {
      this._handle.clearCookies();
    }
  }

  // ─── Internal ─────────────────────────────────────────────────────────

  /**
   * Core request method — uses the persistent handle directly for cookie
   * persistence and connection reuse. Per-request options are set on the
   * handle before each perform call.
   *
   * **WARNING**: This method calls `curl.perform()` which is a synchronous
   * blocking FFI call. The Node.js event loop is blocked for the duration
   * of the HTTP request. For high-concurrency server environments, consider
   * using the low-level `Curl` API with `performAsync()` instead.
   *
   * A non-blocking Session implementation using `curl_multi` + libuv polling
   * is planned for a future release.
   */
  private async _request(
    method: string,
    url: string,
    options?: RequestOptions,
  ): Promise<Response> {
    const curl = this._handle;

    // Per-request impersonation override
    if (options?.impersonate && options.impersonate !== this._options.impersonate) {
      try {
        curl.impersonateStr(options.impersonate, this._options.defaultHeaders);
      } catch (e) {
        throw parseCurlError(e instanceof Error ? e.message : String(e));
      }
    }

    // Build URL with params
    let finalUrl = url;
    if (options?.params) {
      const entries: Record<string, string> = {};
      for (const [k, v] of Object.entries(options.params)) {
        entries[k] = String(v);
      }
      const qs = new URLSearchParams(entries).toString();
      finalUrl += (url.includes('?') ? '&' : '?') + qs;
    }

    curl.setoptStr(CurlOpt.Url, finalUrl);

    // HTTP method — always set explicitly to prevent method leakage
    // between requests on the persistent handle (P2 fix)
    curl.setoptStr(CurlOpt.CustomRequest, method);
    if (method === 'GET' || method === 'HEAD' || method === 'DELETE') {
      curl.setoptLong(CurlOpt.Post, 0);
    } else {
      // Re-enable POST mode for POST/PUT/PATCH — required after a
      // previous GET explicitly disabled it (P2 lifecycle fix)
      curl.setoptLong(CurlOpt.Post, 1);
    }

    // Headers: merge session + request
    const headerList: string[] = [];
    if (this._options.headers) {
      for (const [k, v] of Object.entries(this._options.headers)) {
        headerList.push(`${k}: ${v}`);
      }
    }
    if (options?.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        headerList.push(`${k}: ${v}`);
      }
    }
    // Always set headers to prevent stale headers from previous requests (P4 fix)
    curl.setoptList(CurlOpt.HttpHeader, headerList.length > 0 ? headerList : ['_:']);

    // Body
    if (options?.data !== undefined) {
      let body: string;
      if (Buffer.isBuffer(options.data)) {
        body = options.data.toString('utf8');
      } else if (typeof options.data === 'object') {
        body = JSON.stringify(options.data);
        if (!headerList.some((h) => h.toLowerCase().startsWith('content-type'))) {
          curl.setoptList(CurlOpt.HttpHeader, [
            ...headerList,
            'Content-Type: application/json',
          ]);
        }
      } else {
        body = options.data;
      }
      // Reset PostFieldSize to -1 (auto-detect from string length) before
      // setting PostFields. This is required because a previous bodyless
      // request may have set PostFieldSize=0, causing curl to ignore the
      // body even when PostFields is set (P3 lifecycle fix).
      curl.setoptLong(CurlOpt.PostFieldSize, -1);
      curl.setoptStr(CurlOpt.PostFields, body);
    } else {
      // Clear any previous POST body to prevent data leakage (P3 fix)
      curl.setoptLong(CurlOpt.PostFieldSize, 0);
    }

    // Timeout
    const timeout = options?.timeout ?? this._options.timeout;
    if (timeout && timeout > 0) {
      curl.setoptLong(CurlOpt.TimeoutMs, Math.floor(timeout * 1000));
    } else {
      curl.setoptLong(CurlOpt.TimeoutMs, 0);
    }

    // Redirects
    const followRedirects = options?.followRedirects ?? this._options.followRedirects;
    curl.setoptLong(CurlOpt.FollowLocation, followRedirects ? 1 : 0);
    const maxRedirects = options?.maxRedirects ?? this._options.maxRedirects;
    curl.setoptLong(CurlOpt.MaxRedirs, maxRedirects);

    // Proxy
    const proxy = options?.proxy ?? this._options.proxy;
    if (proxy) {
      curl.setoptStr(CurlOpt.Proxy, proxy);
    }

    // SSL
    const verify = options?.verify ?? this._options.verify;
    if (verify === false) {
      curl.setoptLong(CurlOpt.SslVerifyPeer, 0);
      curl.setoptLong(CurlOpt.SslVerifyHost, 0);
    }

    // Perform synchronously on the persistent handle (keeps cookies!)
    try {
      const result = curl.perform();
      return new Response(result);
    } catch (e) {
      throw parseCurlError(e instanceof Error ? e.message : String(e));
    }
  }
}
