//! CurlOpt — typed enum for curl_easy_setopt options.
//!
//! Maps N-API enum variants to libcurl CURLOPT_* constants.

use crate::ffi;

/// Options for `Curl.setopt()`.
///
/// Each variant maps to a specific `CURLOPT_*` constant from libcurl.
/// The option type (string, long, slist) is determined by the variant.
#[napi]
#[derive(Debug)]
pub enum CurlOpt {
    // ── String options ──────────────────────────────────────────────────
    /// Set the URL to work with.
    Url,
    /// Set custom request method (GET, POST, PUT, DELETE, etc.)
    CustomRequest,
    /// Set the POST data body.
    PostFields,
    /// Set the User-Agent header.
    UserAgent,
    /// Set the Referer header.
    Referer,
    /// Set a cookie string ("name=value; name2=value2").
    Cookie,
    /// Set the file to read cookies from.
    CookieFile,
    /// Set the file to write cookies to.
    CookieJar,
    /// Set proxy URL.
    Proxy,
    /// Set username for authentication.
    Username,
    /// Set password for authentication.
    Password,

    // ── TLS fingerprint string options (curl-impersonate) ───────────────
    /// Set TLS cipher list (e.g., "ECDHE-RSA-AES128-GCM-SHA256:...")
    SslCipherList,
    /// Set TLS 1.3 ciphersuites (e.g., "TLS_AES_128_GCM_SHA256:...")
    Tls13Ciphers,
    /// Set elliptic curves (e.g., "X25519:P-256:P-384")
    SslEcCurves,
    /// Set TLS signature hash algorithms (e.g., "ecdsa_secp256r1_sha256,...")
    SslSigHashAlgs,
    /// Set certificate compression algorithms (e.g., "brotli")
    SslCertCompression,

    // ── HTTP/2 fingerprint string options (curl-impersonate) ────────────
    /// HTTP/2 pseudo-headers order (e.g., "masp" for :method, :authority, :scheme, :path)
    Http2PseudoHeadersOrder,
    /// HTTP/2 SETTINGS frame values (e.g., "1:65536;2:0;3:1000;4:6291456;6:262144")
    Http2Settings,
    /// HTTP/2 stream initial parameters (e.g., "3:0:0:201")
    Http2Streams,

    // ── Long/boolean options ────────────────────────────────────────────
    /// Follow HTTP redirects (0 or 1).
    FollowLocation,
    /// Maximum number of redirects to follow.
    MaxRedirs,
    /// Timeout in milliseconds for the entire transfer.
    TimeoutMs,
    /// Timeout in milliseconds for the connection phase.
    ConnectTimeoutMs,
    /// Verify the SSL peer certificate (0 or 1).
    SslVerifyPeer,
    /// Verify the SSL host (0 or 2).
    SslVerifyHost,
    /// Enable POST method (0 or 1).
    Post,
    /// Set POST data size.
    PostFieldSize,
    /// Set port number.
    Port,
    /// Enable HTTP proxy tunneling (0 or 1).
    HttpProxyTunnel,
    /// Enable upload mode (0 or 1).
    Upload,
    /// Enable TLS ALPS extension (0 or 1).
    SslEnableAlps,
    /// Enable/disable TLS session tickets (0 or 1).
    SslEnableTicket,
    /// Enable TLS extension permutation (0 or 1).
    SslPermuteExtensions,
    /// HTTP version to use (e.g., 4 for HTTP/2).
    HttpVersion,
    /// HTTP/2 initial window update value.
    Http2WindowUpdate,
    /// HTTP/2 stream weight (1-256).
    StreamWeight,

    // ── String list options ─────────────────────────────────────────────
    /// Set custom HTTP headers.
    HttpHeader,
    /// Set proxy-specific headers.
    ProxyHeader,
    /// Set custom DNS resolve mappings.
    Resolve,
}

impl CurlOpt {
    /// Returns the libcurl CURLOPT_* constant for this option.
    pub fn to_ffi(&self) -> ffi::CURLoption {
        match self {
            CurlOpt::Url => ffi::CURLOPT_URL,
            CurlOpt::CustomRequest => ffi::CURLOPT_CUSTOMREQUEST,
            CurlOpt::PostFields => ffi::CURLOPT_POSTFIELDS,
            CurlOpt::UserAgent => ffi::CURLOPT_USERAGENT,
            CurlOpt::Referer => ffi::CURLOPT_REFERER,
            CurlOpt::Cookie => ffi::CURLOPT_COOKIE,
            CurlOpt::CookieFile => ffi::CURLOPT_COOKIEFILE,
            CurlOpt::CookieJar => ffi::CURLOPT_COOKIEJAR,
            CurlOpt::Proxy => ffi::CURLOPT_PROXY,
            CurlOpt::Username => ffi::CURLOPT_USERNAME,
            CurlOpt::Password => ffi::CURLOPT_PASSWORD,
            CurlOpt::SslCipherList => ffi::CURLOPT_SSL_CIPHER_LIST,
            CurlOpt::Tls13Ciphers => ffi::CURLOPT_TLS13_CIPHERS,
            CurlOpt::SslEcCurves => ffi::CURLOPT_SSL_EC_CURVES,
            CurlOpt::SslSigHashAlgs => ffi::CURLOPT_SSL_SIG_HASH_ALGS,
            CurlOpt::SslCertCompression => ffi::CURLOPT_SSL_CERT_COMPRESSION,
            CurlOpt::Http2PseudoHeadersOrder => ffi::CURLOPT_HTTP2_PSEUDO_HEADERS_ORDER,
            CurlOpt::Http2Settings => ffi::CURLOPT_HTTP2_SETTINGS,
            CurlOpt::Http2Streams => ffi::CURLOPT_HTTP2_STREAMS,
            CurlOpt::FollowLocation => ffi::CURLOPT_FOLLOWLOCATION,
            CurlOpt::MaxRedirs => ffi::CURLOPT_MAXREDIRS,
            CurlOpt::TimeoutMs => ffi::CURLOPT_TIMEOUT_MS,
            CurlOpt::ConnectTimeoutMs => ffi::CURLOPT_CONNECTTIMEOUT_MS,
            CurlOpt::SslVerifyPeer => ffi::CURLOPT_SSL_VERIFYPEER,
            CurlOpt::SslVerifyHost => ffi::CURLOPT_SSL_VERIFYHOST,
            CurlOpt::Post => ffi::CURLOPT_POST,
            CurlOpt::PostFieldSize => ffi::CURLOPT_POSTFIELDSIZE,
            CurlOpt::Port => ffi::CURLOPT_PORT,
            CurlOpt::HttpProxyTunnel => ffi::CURLOPT_HTTPPROXYTUNNEL,
            CurlOpt::Upload => ffi::CURLOPT_UPLOAD,
            CurlOpt::SslEnableAlps => ffi::CURLOPT_SSL_ENABLE_ALPS,
            CurlOpt::SslEnableTicket => ffi::CURLOPT_SSL_ENABLE_TICKET,
            CurlOpt::SslPermuteExtensions => ffi::CURLOPT_SSL_PERMUTE_EXTENSIONS,
            CurlOpt::HttpVersion => ffi::CURLOPT_HTTP_VERSION,
            CurlOpt::Http2WindowUpdate => ffi::CURLOPT_HTTP2_WINDOW_UPDATE,
            CurlOpt::StreamWeight => ffi::CURLOPT_STREAM_WEIGHT,
            CurlOpt::HttpHeader => ffi::CURLOPT_HTTPHEADER,
            CurlOpt::ProxyHeader => ffi::CURLOPT_PROXYHEADER,
            CurlOpt::Resolve => ffi::CURLOPT_RESOLVE,
        }
    }

    /// Returns the option type category.
    pub fn option_type(&self) -> OptType {
        match self {
            CurlOpt::Url
            | CurlOpt::CustomRequest
            | CurlOpt::PostFields
            | CurlOpt::UserAgent
            | CurlOpt::Referer
            | CurlOpt::Cookie
            | CurlOpt::CookieFile
            | CurlOpt::CookieJar
            | CurlOpt::Proxy
            | CurlOpt::Username
            | CurlOpt::Password
            | CurlOpt::SslCipherList
            | CurlOpt::Tls13Ciphers
            | CurlOpt::SslEcCurves
            | CurlOpt::SslSigHashAlgs
            | CurlOpt::SslCertCompression
            | CurlOpt::Http2PseudoHeadersOrder
            | CurlOpt::Http2Settings
            | CurlOpt::Http2Streams => OptType::String,

            CurlOpt::FollowLocation
            | CurlOpt::MaxRedirs
            | CurlOpt::TimeoutMs
            | CurlOpt::ConnectTimeoutMs
            | CurlOpt::SslVerifyPeer
            | CurlOpt::SslVerifyHost
            | CurlOpt::Post
            | CurlOpt::PostFieldSize
            | CurlOpt::Port
            | CurlOpt::HttpProxyTunnel
            | CurlOpt::Upload
            | CurlOpt::SslEnableAlps
            | CurlOpt::SslEnableTicket
            | CurlOpt::SslPermuteExtensions
            | CurlOpt::HttpVersion
            | CurlOpt::Http2WindowUpdate
            | CurlOpt::StreamWeight => OptType::Long,

            CurlOpt::HttpHeader | CurlOpt::ProxyHeader | CurlOpt::Resolve => OptType::SList,
        }
    }
}

/// The type category for a curl option value.
pub enum OptType {
    String,
    Long,
    SList,
}
