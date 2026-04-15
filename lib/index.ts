/**
 * curl-cffi-node — Node.js binding for curl-impersonate
 *
 * Provides browser-impersonating HTTP client with TLS/JA3/HTTP2 fingerprinting.
 *
 * @module curl-cffi-node
 */

import { nativeBinding } from './binding.js';

// ─── Re-exports ──────────────────────────────────────────────────────────────

export { Response, Headers, type Timing } from './response.js';
export {
  CurlError,
  TimeoutError,
  ConnectionError,
  TLSError,
  ProxyError,
  CurlCode,
  parseCurlError,
} from './errors.js';
export {
  Session,
  type SessionOptions,
  type RequestOptions,
} from './session.js';
export {
  CurlWebSocket,
  type CurlWebSocketOptions,
  WS_TEXT,
  WS_BINARY,
  WS_CLOSE,
} from './websocket.js';
export type {
  CurlHandle,
  PerformResult,
  WsFrame,
  NativeBinding,
} from './types.js';

// ─── Native Bindings ─────────────────────────────────────────────────────────

/**
 * Returns a greeting from the native module to verify binding works.
 */
export const hello = nativeBinding.hello;

/**
 * Returns the version of the native Rust module.
 */
export const nativeVersion = nativeBinding.nativeVersion;

/**
 * Returns the version string from the linked libcurl-impersonate library.
 */
export const curlVersion = nativeBinding.curlVersion;

// ─── Curl Handle Class (Low-level) ──────────────────────────────────────────

export { CurlOpt, CurlInfo, BrowserType } from './enums.js';

export const Curl = nativeBinding.Curl;

// ─── Shorthand Functions (Story 3.5) ────────────────────────────────────────

import { Session, type RequestOptions } from './session.js';
import type { Response } from './response.js';

/** Shorthand for a GET request. Creates a temporary session. */
export async function get(
  url: string,
  options?: RequestOptions & { impersonate?: string },
): Promise<Response> {
  const session = new Session({ impersonate: options?.impersonate });
  return session.get(url, options);
}

/** Shorthand for a POST request. */
export async function post(
  url: string,
  options?: RequestOptions & { impersonate?: string },
): Promise<Response> {
  const session = new Session({ impersonate: options?.impersonate });
  return session.post(url, options);
}

/** Shorthand for a PUT request. */
export async function put(
  url: string,
  options?: RequestOptions & { impersonate?: string },
): Promise<Response> {
  const session = new Session({ impersonate: options?.impersonate });
  return session.put(url, options);
}

/** Shorthand for a DELETE request. */
export async function del(
  url: string,
  options?: RequestOptions & { impersonate?: string },
): Promise<Response> {
  const session = new Session({ impersonate: options?.impersonate });
  return session.delete(url, options);
}

/** Shorthand for a HEAD request. */
export async function head(
  url: string,
  options?: RequestOptions & { impersonate?: string },
): Promise<Response> {
  const session = new Session({ impersonate: options?.impersonate });
  return session.head(url, options);
}

/** Shorthand for a PATCH request. */
export async function patch(
  url: string,
  options?: RequestOptions & { impersonate?: string },
): Promise<Response> {
  const session = new Session({ impersonate: options?.impersonate });
  return session.patch(url, options);
}
