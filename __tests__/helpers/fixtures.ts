/**
 * Shared test fixtures, constants, and module loader.
 *
 * Centralizes all native module imports and test configuration
 * to eliminate duplication across test files.
 */

import { join } from 'path';

// ─── Module Loader ───────────────────────────────────────────────────────────

export const ROOT = join(import.meta.dirname!, '..', '..');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require(join(ROOT, 'dist', 'index.js'));

// ─── Native Exports ──────────────────────────────────────────────────────────

export const Curl = mod.Curl;
export const CurlOpt = mod.CurlOpt;
export const CurlInfo = mod.CurlInfo;
export const BrowserType = mod.BrowserType;

// ─── High-Level API ──────────────────────────────────────────────────────────

export const Session = mod.Session;
export const Response = mod.Response;
export const Headers = mod.Headers;
export const CurlWebSocket = mod.CurlWebSocket;

// ─── Error Classes ───────────────────────────────────────────────────────────

export const CurlError = mod.CurlError;
export const TimeoutError = mod.TimeoutError;
export const ConnectionError = mod.ConnectionError;
export const TLSError = mod.TLSError;
export const ProxyError = mod.ProxyError;
export const CurlCode = mod.CurlCode;
export const parseCurlError = mod.parseCurlError;

// ─── Shorthand Functions ─────────────────────────────────────────────────────

export const get = mod.get;
export const post = mod.post;
export const del = mod.del;
export const put = mod.put;
export const head = mod.head;
export const patch = mod.patch;

// ─── Test Configuration ──────────────────────────────────────────────────────

/** Default timeout for test HTTP requests (ms). */
export const TIMEOUT_MS = Number(process.env.TEST_TIMEOUT_MS) || 5000;

/** Longer timeout for slow operations (TLS checks, WS connect). */
export const SLOW_TIMEOUT_MS = Number(process.env.TEST_SLOW_TIMEOUT_MS) || 15000;

// ─── External Service URLs (for e2e tests only) ─────────────────────────────

export const EXTERNAL = {
  HTTPBIN: 'https://httpbin.org',
  TLS_CHECK: 'https://tls.peet.ws/api/all',
  WS_ECHO: 'wss://ws.postman-echo.com/raw',
} as const;
