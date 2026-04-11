/**
 * TypeScript enum declarations for native napi-rs enums.
 *
 * These mirror the Rust enum variants in exact declaration order.
 * napi-rs numeric enums map to sequential integers starting from 0.
 * napi-rs string_enum maps to string values.
 */

// ─── CurlOpt ────────────────────────────────────────────────────────────────

/** Options for `Curl.setoptStr()`, `Curl.setoptLong()`, `Curl.setoptList()`. */
export enum CurlOpt {
  // String options
  Url = 0,
  CustomRequest = 1,
  PostFields = 2,
  UserAgent = 3,
  Referer = 4,
  Cookie = 5,
  CookieFile = 6,
  CookieJar = 7,
  Proxy = 8,
  Username = 9,
  Password = 10,

  // TLS fingerprint string options
  SslCipherList = 11,
  Tls13Ciphers = 12,
  SslEcCurves = 13,
  SslSigHashAlgs = 14,
  SslCertCompression = 15,

  // HTTP/2 fingerprint string options
  Http2PseudoHeadersOrder = 16,
  Http2Settings = 17,
  Http2Streams = 18,

  // Long/boolean options
  FollowLocation = 19,
  MaxRedirs = 20,
  TimeoutMs = 21,
  ConnectTimeoutMs = 22,
  SslVerifyPeer = 23,
  SslVerifyHost = 24,
  Post = 25,
  PostFieldSize = 26,
  Port = 27,
  HttpProxyTunnel = 28,
  Upload = 29,
  SslEnableAlps = 30,
  SslEnableTicket = 31,
  SslPermuteExtensions = 32,
  HttpVersion = 33,
  Http2WindowUpdate = 34,
  StreamWeight = 35,

  // String list options
  HttpHeader = 36,
  ProxyHeader = 37,
  Resolve = 38,

  // Advanced TLS fingerprint options (curl-impersonate)
  /** Enable GREASE in TLS handshake (0 or 1). */
  TlsGrease = 39,
  /** Set TLS extension order string. */
  TlsExtensionOrder = 40,
  /** Enable HTTP/2 exclusive stream flag (0 or 1). */
  StreamExclusive = 41,
  /** Skip TLS key usage check (0 or 1). */
  TlsKeyUsageNoCheck = 42,
  /** Enable Signed Certificate Timestamps extension (0 or 1). */
  TlsSignedCertTimestamps = 43,
  /** Enable OCSP status request extension (0 or 1). */
  TlsStatusRequest = 44,
  /** Set delegated credentials configuration string. */
  TlsDelegatedCredentials = 45,
  /** Set TLS record size limit. */
  TlsRecordSizeLimit = 46,
  /** Set TLS key shares limit. */
  TlsKeySharesLimit = 47,
  /** Use new ALPS codepoint (0 or 1). */
  TlsUseNewAlpsCodepoint = 48,
  /** Disable HTTP/2 priority frames (0 or 1). */
  Http2NoPriority = 49,
}

// ─── CurlInfo ────────────────────────────────────────────────────────────────

/** Info keys for `Curl.getinfo()`. */
export enum CurlInfo {
  /** The last HTTP response code. */
  ResponseCode = 0,
  /** Total time for the transfer in seconds. */
  TotalTime = 1,
  /** Time for name resolving in seconds. */
  NameLookupTime = 2,
  /** Time to connect in seconds. */
  ConnectTime = 3,
  /** Time to SSL/TLS handshake in seconds. */
  AppConnectTime = 4,
  /** Time until the first byte was received in seconds. */
  StartTransferTime = 5,
  /** The effective URL that was fetched (after redirects). */
  EffectiveUrl = 6,
}

// ─── BrowserType ─────────────────────────────────────────────────────────────

/**
 * Browser impersonation targets for `Curl.impersonate()`.
 *
 * This is a string enum — values are the target strings accepted by
 * curl_easy_impersonate().
 */
export enum BrowserType {
  // Chrome Desktop
  Chrome99 = 'chrome99',
  Chrome100 = 'chrome100',
  Chrome101 = 'chrome101',
  Chrome104 = 'chrome104',
  Chrome107 = 'chrome107',
  Chrome110 = 'chrome110',
  Chrome116 = 'chrome116',
  Chrome119 = 'chrome119',
  Chrome120 = 'chrome120',
  Chrome123 = 'chrome123',
  Chrome124 = 'chrome124',
  Chrome131 = 'chrome131',

  // Chrome Android
  Chrome99Android = 'chrome99_android',
  Chrome131Android = 'chrome131_android',

  // Edge
  Edge99 = 'edge99',
  Edge101 = 'edge101',

  // Safari Desktop
  Safari15_3 = 'safari15_3',
  Safari15_5 = 'safari15_5',
  Safari17_0 = 'safari17_0',
  Safari18_0 = 'safari18_0',

  // Safari iOS
  Safari17_2_iOS = 'safari17_2_ios',
  Safari18_0_iOS = 'safari18_0_ios',

  // Firefox
  Firefox133 = 'firefox133',
}
