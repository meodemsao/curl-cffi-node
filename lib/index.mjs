/**
 * ESM wrapper for curl-cffi-node.
 *
 * Native .node binaries can only be loaded via require(), so the CJS
 * build is canonical. This thin wrapper re-exports all public API as
 * ESM named exports for consumers using `import`.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const cjsModule = require('./index.js');

// Native bindings
export const hello = cjsModule.hello;
export const nativeVersion = cjsModule.nativeVersion;
export const curlVersion = cjsModule.curlVersion;
export const CurlOpt = cjsModule.CurlOpt;
export const CurlInfo = cjsModule.CurlInfo;
export const BrowserType = cjsModule.BrowserType;
export const Curl = cjsModule.Curl;

// High-level API
export const Response = cjsModule.Response;
export const Headers = cjsModule.Headers;
export const Session = cjsModule.Session;

// Errors
export const CurlError = cjsModule.CurlError;
export const TimeoutError = cjsModule.TimeoutError;
export const ConnectionError = cjsModule.ConnectionError;
export const TLSError = cjsModule.TLSError;
export const ProxyError = cjsModule.ProxyError;
export const CurlCode = cjsModule.CurlCode;
export const parseCurlError = cjsModule.parseCurlError;

// Shorthand functions
export const get = cjsModule.get;
export const post = cjsModule.post;
export const put = cjsModule.put;
export const del = cjsModule.del;
export const head = cjsModule.head;
export const patch = cjsModule.patch;

// WebSocket
export const CurlWebSocket = cjsModule.CurlWebSocket;
export const WS_TEXT = cjsModule.WS_TEXT;
export const WS_BINARY = cjsModule.WS_BINARY;
export const WS_CLOSE = cjsModule.WS_CLOSE;

export default cjsModule;
