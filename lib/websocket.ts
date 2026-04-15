/**
 * CurlWebSocket — WebSocket client with TLS fingerprint impersonation.
 *
 * Uses curl's native WebSocket API (curl_ws_send/curl_ws_recv) under the hood,
 * providing impersonated TLS handshakes for anti-bot evasion.
 *
 * @example
 * ```ts
 * const ws = new CurlWebSocket('wss://echo.websocket.org', { impersonate: 'chrome116' });
 * ws.on('open', () => ws.send('Hello!'));
 * ws.on('message', (data) => console.log('Received:', data));
 * ws.on('close', () => console.log('Closed'));
 * await ws.connect();
 * ```
 */

import { EventEmitter } from 'events';
import { nativeBinding } from './binding.js';
import { CurlOpt } from './enums.js';
import { parseCurlError } from './errors.js';
import type { CurlHandle } from './types.js';

// WebSocket frame flags (matching libcurl CURLWS_*)
export const WS_TEXT = 1;
export const WS_BINARY = 2;
export const WS_CLOSE = 8;

export interface CurlWebSocketOptions {
  /** Browser to impersonate for TLS fingerprinting. */
  impersonate?: string;
  /** Custom headers for the upgrade request. */
  headers?: Record<string, string>;
  /** Whether to apply default browser headers (default: true). */
  defaultHeaders?: boolean;
  /** Timeout for the initial connection in seconds. */
  timeout?: number;
  /** Proxy URL. */
  proxy?: string;
  /** Whether to verify SSL (default: true). */
  verify?: boolean;
}

export class CurlWebSocket extends EventEmitter {
  private _handle: CurlHandle;
  private _url: string;
  private _options: CurlWebSocketOptions;
  private _connected = false;
  private _polling = false;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(url: string, options: CurlWebSocketOptions = {}) {
    super();
    this._url = url;
    this._options = options;
    this._handle = new nativeBinding.Curl();

    // Configure
    this._handle.setoptStr(CurlOpt.Url, url);

    if (options.impersonate) {
      this._handle.impersonateStr(
        options.impersonate,
        options.defaultHeaders ?? true,
      );
    }

    if (options.headers) {
      const list: string[] = [];
      for (const [k, v] of Object.entries(options.headers)) {
        list.push(`${k}: ${v}`);
      }
      this._handle.setoptList(CurlOpt.HttpHeader, list);
    }

    if (options.timeout) {
      this._handle.setoptLong(
        CurlOpt.ConnectTimeoutMs,
        Math.floor(options.timeout * 1000),
      );
    }

    if (options.proxy) {
      this._handle.setoptStr(CurlOpt.Proxy, options.proxy);
    }

    if (options.verify === false) {
      this._handle.setoptLong(CurlOpt.SslVerifyPeer, 0);
      this._handle.setoptLong(CurlOpt.SslVerifyHost, 0);
    }

    this._handle.setoptLong(CurlOpt.FollowLocation, 1);
  }

  /** Whether the WebSocket is currently connected. */
  get connected(): boolean {
    return this._connected;
  }

  /** The WebSocket URL. */
  get url(): string {
    return this._url;
  }

  /**
   * Establish the WebSocket connection.
   *
   * Performs the HTTP upgrade handshake and starts the receive loop.
   * Emits 'open' when connected, 'error' on failure.
   */
  async connect(): Promise<void> {
    try {
      this._handle.wsConnect();
      this._connected = true;
      this.emit('open');
      this._startRecvLoop();
    } catch (e) {
      const err = parseCurlError(e instanceof Error ? e.message : String(e));
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Send a text message.
   */
  send(data: string): void;
  /**
   * Send a binary message.
   */
  send(data: Buffer): void;
  send(data: string | Buffer): void {
    if (!this._connected) {
      throw new Error('WebSocket is not connected');
    }

    try {
      if (typeof data === 'string') {
        this._handle.wsSend(Buffer.from(data, 'utf8'), WS_TEXT);
      } else {
        this._handle.wsSend(data, WS_BINARY);
      }
    } catch (e) {
      const err = parseCurlError(e instanceof Error ? e.message : String(e));
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Close the WebSocket connection gracefully.
   */
  close(): void {
    if (!this._connected) return;

    this._stopRecvLoop();

    try {
      this._handle.wsSend(Buffer.alloc(0), WS_CLOSE);
    } catch (_) {
      // Ignore errors during close — connection may already be dead
    }

    this._connected = false;
    this.emit('close');
  }

  // ─── Internal ─────────────────────────────────────────────────────────

  private _startRecvLoop(): void {
    if (this._polling) return;
    this._polling = true;

    // Poll for incoming messages using setInterval
    this._pollTimer = setInterval(() => {
      if (!this._connected || !this._polling) {
        this._stopRecvLoop();
        return;
      }

      try {
        const frame = this._handle.wsRecv();
        if (frame === null) return; // No data available (CURLE_AGAIN)

        if (frame.flags & WS_CLOSE) {
          this._stopRecvLoop();
          this._connected = false;
          this.emit('close');
          return;
        }

        if (frame.flags & WS_TEXT) {
          this.emit('message', frame.data.toString('utf8'));
        } else if (frame.flags & WS_BINARY) {
          this.emit('message', frame.data);
        } else {
          // Other frame types (e.g., continuation)
          this.emit('message', frame.data);
        }
      } catch (_e) {
        // Connection closed by server — treat as clean close
        this._stopRecvLoop();
        if (this._connected) {
          this._connected = false;
          this.emit('close');
        }
      }
    }, 10); // 10ms polling interval
  }

  private _stopRecvLoop(): void {
    this._polling = false;
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }
}
