/**
 * Shared type definitions for curl-cffi-node.
 *
 * Centralizes all interfaces used across the binding, session, and websocket
 * modules to eliminate `any` casts and ensure end-to-end type safety.
 *
 * @module types
 */

import type { CurlOpt, CurlInfo } from './enums.js';

// ─── Transfer Results ────────────────────────────────────────────────────────

/** Result of a `Curl.perform()` or `Curl.performAsync()` call. */
export interface PerformResult {
  /** Response body as a Buffer. */
  body: Buffer;
  /** Raw response headers as a string (each header line separated by \r\n). */
  headers: string;
  /** HTTP status code (e.g., 200, 404, 500). */
  statusCode: number;
  /** The effective URL after any redirects. */
  effectiveUrl: string;
  /** DNS resolution time in milliseconds. */
  dnsTimeMs: number;
  /** TCP connection time in milliseconds. */
  connectTimeMs: number;
  /** TLS handshake time in milliseconds. */
  tlsTimeMs: number;
  /** Total request time in milliseconds. */
  totalTimeMs: number;
}

/** WebSocket frame received from wsRecv(). */
export interface WsFrame {
  /** Frame payload data. */
  data: Buffer;
  /** Frame flags (CURLWS_TEXT=1, CURLWS_BINARY=2, CURLWS_CLOSE=8). */
  flags: number;
}

// ─── Curl Handle ─────────────────────────────────────────────────────────────

/**
 * Typed interface for a native Curl easy handle.
 *
 * When instantiated via `new Curl()`, the handle is automatically cleaned up
 * when garbage collected (`curl_easy_cleanup` is called).
 */
export interface CurlHandle {
  // ── Option Setters ──────────────────────────────────────────────────────

  /** Set a string option on the curl handle. */
  setoptStr(opt: CurlOpt, value: string): void;

  /** Set a long/boolean option on the curl handle. */
  setoptLong(opt: CurlOpt, value: number): void;

  /** Set a string-list option on the curl handle. */
  setoptList(opt: CurlOpt, values: string[]): void;

  // ── Info Getter ─────────────────────────────────────────────────────────

  /** Get info from the curl handle after a transfer. */
  getinfo(info: CurlInfo): number | string;

  // ── Impersonation ───────────────────────────────────────────────────────

  /** Set browser impersonation using a raw string target. */
  impersonateStr(target: string, defaultHeaders?: boolean): void;

  // ── Transfer ────────────────────────────────────────────────────────────

  /** Perform a synchronous HTTP request (blocks the event loop). */
  perform(): PerformResult;

  /** Perform an asynchronous HTTP request on a libuv thread pool worker. */
  performAsync(): Promise<PerformResult>;

  // ── Cookie Engine ───────────────────────────────────────────────────────

  /** Enable the in-memory cookie engine. Must be called before perform. */
  enableCookies(): void;

  /** Get all cookies from the cookie engine as Netscape-format strings. */
  getCookies(): string[];

  /** Add a cookie to the cookie engine in Netscape format. */
  addCookie(cookieLine: string): void;

  /** Clear all cookies from the cookie engine. */
  clearCookies(): void;

  // ── WebSocket ───────────────────────────────────────────────────────────

  /** Connect to a WebSocket server (sets CONNECT_ONLY=2 and performs upgrade). */
  wsConnect(): void;

  /** Send data on a WebSocket connection. */
  wsSend(data: Buffer, flags: number): void;

  /** Receive one frame from a WebSocket connection. Returns null if no data. */
  wsRecv(bufferSize?: number): WsFrame | null;

  // ── Handle Lifecycle ────────────────────────────────────────────────────

  /** Reset all options to defaults, allowing handle reuse. */
  reset(): void;

  /** Clone this curl handle with all its options. */
  duplicate(): CurlHandle;

  /** Get a human-readable error description for the last error code. */
  strerror(code: number): string;
}

// ─── Native Binding ──────────────────────────────────────────────────────────

/** Typed interface for the native NAPI-RS binding module. */
export interface NativeBinding {
  /** The native Curl handle constructor. */
  Curl: { new(): CurlHandle };

  /** Verify the napi binding works correctly. */
  hello(): string;

  /** Returns the version of the native module. */
  nativeVersion(): string;

  /** Returns the libcurl version string from curl-impersonate. */
  curlVersion(): string;
}
