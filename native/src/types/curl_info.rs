//! CurlInfo — typed enum for curl_easy_getinfo info keys.
//!
//! Maps N-API enum variants to libcurl CURLINFO_* constants.

use crate::ffi;

/// Info keys for `Curl.getinfo()`.
///
/// Each variant maps to a specific `CURLINFO_*` constant from libcurl.
/// The return type (string, long, double) is determined by the variant.
#[napi]
pub enum CurlInfo {
    // ── Long info ───────────────────────────────────────────────────────
    /// The last HTTP response code.
    ResponseCode,

    // ── Double info (timing) ────────────────────────────────────────────
    /// Total time for the transfer in seconds.
    TotalTime,
    /// Time for name resolving in seconds.
    NameLookupTime,
    /// Time to connect in seconds.
    ConnectTime,
    /// Time to SSL/TLS handshake in seconds.
    AppConnectTime,
    /// Time until the first byte was received in seconds.
    StartTransferTime,

    // ── String info ─────────────────────────────────────────────────────
    /// The effective URL that was fetched (after redirects).
    EffectiveUrl,
}

impl CurlInfo {
    /// Returns the libcurl CURLINFO_* constant for this info key.
    pub fn to_ffi(&self) -> ffi::CURLINFO {
        match self {
            CurlInfo::ResponseCode => ffi::CURLINFO_RESPONSE_CODE,
            CurlInfo::TotalTime => ffi::CURLINFO_TOTAL_TIME,
            CurlInfo::NameLookupTime => ffi::CURLINFO_NAMELOOKUP_TIME,
            CurlInfo::ConnectTime => ffi::CURLINFO_CONNECT_TIME,
            CurlInfo::AppConnectTime => ffi::CURLINFO_APPCONNECT_TIME,
            CurlInfo::StartTransferTime => ffi::CURLINFO_STARTTRANSFER_TIME,
            CurlInfo::EffectiveUrl => ffi::CURLINFO_EFFECTIVE_URL,
        }
    }

    /// Returns the info type category.
    pub fn info_type(&self) -> InfoType {
        match self {
            CurlInfo::ResponseCode => InfoType::Long,
            CurlInfo::TotalTime
            | CurlInfo::NameLookupTime
            | CurlInfo::ConnectTime
            | CurlInfo::AppConnectTime
            | CurlInfo::StartTransferTime => InfoType::Double,
            CurlInfo::EffectiveUrl => InfoType::String,
        }
    }
}

/// The type category for a curl info return value.
pub enum InfoType {
    String,
    Long,
    Double,
}
