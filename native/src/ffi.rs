//! Low-level FFI bindings to libcurl-impersonate.
//!
//! These are the minimal `extern "C"` declarations needed for the
//! curl-cffi-node binding. Additional functions will be added as
//! stories in Epic 2 require them.

#![allow(non_camel_case_types)]
#![allow(dead_code)]

use std::ffi::c_void;
use std::os::raw::{c_char, c_int, c_long};

/// Opaque handle for a curl easy session.
pub type CURL = c_void;

/// Opaque handle for a curl multi session.
pub type CURLM = c_void;

/// Opaque handle for a share interface.
pub type CURLSH = c_void;

/// Opaque linked-list type (curl_slist).
#[repr(C)]
pub struct curl_slist {
    pub data: *mut c_char,
    pub next: *mut curl_slist,
}

/// CURLcode — return codes for curl_easy_perform and related functions.
pub type CURLcode = c_int;

/// CURLoption — option IDs for curl_easy_setopt.
pub type CURLoption = c_int;

/// CURLINFO — info IDs for curl_easy_getinfo.
pub type CURLINFO = c_int;

// Common CURLcode values
pub const CURLE_OK: CURLcode = 0;
pub const CURLE_UNSUPPORTED_PROTOCOL: CURLcode = 1;
pub const CURLE_COULDNT_CONNECT: CURLcode = 7;
pub const CURLE_OPERATION_TIMEDOUT: CURLcode = 28;
pub const CURLE_SSL_CONNECT_ERROR: CURLcode = 35;
pub const CURLE_PEER_FAILED_VERIFICATION: CURLcode = 60;

// Common CURLoption values
pub const CURLOPT_URL: CURLoption = 10002;
pub const CURLOPT_PORT: CURLoption = 3;
pub const CURLOPT_PROXY: CURLoption = 10004;
pub const CURLOPT_HTTPHEADER: CURLoption = 10023;
pub const CURLOPT_POST: CURLoption = 47;
pub const CURLOPT_POSTFIELDS: CURLoption = 10015;
pub const CURLOPT_POSTFIELDSIZE: CURLoption = 60;
pub const CURLOPT_CUSTOMREQUEST: CURLoption = 10036;
pub const CURLOPT_FOLLOWLOCATION: CURLoption = 52;
pub const CURLOPT_MAXREDIRS: CURLoption = 68;
pub const CURLOPT_TIMEOUT_MS: CURLoption = 155;
pub const CURLOPT_CONNECTTIMEOUT_MS: CURLoption = 156;
pub const CURLOPT_SSL_VERIFYPEER: CURLoption = 64;
pub const CURLOPT_SSL_VERIFYHOST: CURLoption = 81;
pub const CURLOPT_WRITEFUNCTION: CURLoption = 20011;
pub const CURLOPT_WRITEDATA: CURLoption = 10001;
pub const CURLOPT_HEADERFUNCTION: CURLoption = 20079;
pub const CURLOPT_HEADERDATA: CURLoption = 10029;
pub const CURLOPT_COOKIE: CURLoption = 10022;
pub const CURLOPT_COOKIEFILE: CURLoption = 10031;
pub const CURLOPT_COOKIEJAR: CURLoption = 10082;
pub const CURLOPT_COOKIELIST: CURLoption = 10135;
pub const CURLOPT_USERAGENT: CURLoption = 10018;
pub const CURLOPT_REFERER: CURLoption = 10016;
pub const CURLOPT_USERNAME: CURLoption = 10173;
pub const CURLOPT_PASSWORD: CURLoption = 10174;
pub const CURLOPT_UPLOAD: CURLoption = 46;
pub const CURLOPT_READFUNCTION: CURLoption = 20012;
pub const CURLOPT_INFILESIZE: CURLoption = 14;
pub const CURLOPT_HTTPPROXYTUNNEL: CURLoption = 61;
pub const CURLOPT_PROXYHEADER: CURLoption = 10228;
pub const CURLOPT_RESOLVE: CURLoption = 10203;

// Common CURLINFO values
pub const CURLINFO_RESPONSE_CODE: CURLINFO = 0x200002;
pub const CURLINFO_TOTAL_TIME: CURLINFO = 0x300003;
pub const CURLINFO_EFFECTIVE_URL: CURLINFO = 0x100001;
pub const CURLINFO_NAMELOOKUP_TIME: CURLINFO = 0x300004;
pub const CURLINFO_CONNECT_TIME: CURLINFO = 0x300005;
pub const CURLINFO_APPCONNECT_TIME: CURLINFO = 0x300006;
pub const CURLINFO_STARTTRANSFER_TIME: CURLINFO = 0x300011;
pub const CURLINFO_COOKIELIST: CURLINFO = 0x40001C; // CURLINFO_SLIST + 28

// curl-impersonate specific options — TLS fingerprinting
pub const CURLOPT_SSL_EC_CURVES: CURLoption = 10298;
pub const CURLOPT_SSL_CIPHER_LIST: CURLoption = 10083;
pub const CURLOPT_TLS13_CIPHERS: CURLoption = 10276;
pub const CURLOPT_SSL_SIG_HASH_ALGS: CURLoption = 11001; // CURLOPTTYPE_STRINGPOINT + 1001
pub const CURLOPT_SSL_ENABLE_ALPS: CURLoption = 1002;
pub const CURLOPT_SSL_CERT_COMPRESSION: CURLoption = 11003;
pub const CURLOPT_SSL_ENABLE_TICKET: CURLoption = 1004;
pub const CURLOPT_SSL_PERMUTE_EXTENSIONS: CURLoption = 1007;

// curl-impersonate specific options — HTTP/2 fingerprinting
pub const CURLOPT_HTTP_VERSION: CURLoption = 84;
pub const CURLOPT_HTTP2_PSEUDO_HEADERS_ORDER: CURLoption = 11005;
pub const CURLOPT_HTTP2_SETTINGS: CURLoption = 11006;
pub const CURLOPT_HTTP2_WINDOW_UPDATE: CURLoption = 1008;
pub const CURLOPT_HTTP2_STREAMS: CURLoption = 11010;
pub const CURLOPT_STREAM_WEIGHT: CURLoption = 239;
pub const CURLOPT_CONNECT_ONLY: CURLoption = 141;
pub const CURLOPT_WS_OPTIONS: CURLoption = 320;

// WebSocket frame flags
pub const CURLWS_TEXT: u32 = 1 << 0;
pub const CURLWS_BINARY: u32 = 1 << 1;
pub const CURLWS_CLOSE: u32 = 1 << 3;

/// WebSocket frame metadata
#[repr(C)]
pub struct curl_ws_frame {
    pub age: c_int,
    pub flags: c_int,
    pub offset: i64,
    pub bytesleft: i64,
    pub len: usize,
}

extern "C" {
    // === Initialization & Cleanup ===

    /// Initialize a curl session. Returns a CURL easy handle.
    ///
    /// # Safety
    /// The returned handle must be cleaned up with `curl_easy_cleanup`.
    pub fn curl_easy_init() -> *mut CURL;

    /// End a curl easy session and free all resources.
    ///
    /// # Safety
    /// `handle` must be a valid CURL* returned by `curl_easy_init`.
    pub fn curl_easy_cleanup(handle: *mut CURL);

    /// Clone a curl easy handle with all its options.
    ///
    /// # Safety
    /// `handle` must be a valid CURL* returned by `curl_easy_init`.
    pub fn curl_easy_duphandle(handle: *mut CURL) -> *mut CURL;

    /// Reset all options of a curl handle to their defaults.
    ///
    /// # Safety
    /// `handle` must be a valid CURL*.
    pub fn curl_easy_reset(handle: *mut CURL);

    // === Set Options ===

    /// Set options for a curl easy handle (string variant).
    ///
    /// # Safety
    /// `handle` must be valid. `value` must be a valid C string for string options.
    pub fn curl_easy_setopt(handle: *mut CURL, option: CURLoption, ...) -> CURLcode;

    // === Perform ===

    /// Perform a blocking file transfer.
    ///
    /// # Safety
    /// `handle` must be a valid CURL* with URL set.
    pub fn curl_easy_perform(handle: *mut CURL) -> CURLcode;

    // === Get Info ===

    /// Extract information from a curl handle after a transfer.
    ///
    /// # Safety
    /// `handle` must be valid. The variadic arg type depends on the info ID.
    pub fn curl_easy_getinfo(handle: *mut CURL, info: CURLINFO, ...) -> CURLcode;

    /// Return a human-readable error message for a CURLcode.
    ///
    /// # Safety
    /// Always safe to call with any CURLcode value.
    pub fn curl_easy_strerror(code: CURLcode) -> *const c_char;

    // === String Lists ===

    /// Append a string to a curl_slist.
    ///
    /// # Safety
    /// `list` can be null (starts a new list). `string` must be a valid C string.
    pub fn curl_slist_append(list: *mut curl_slist, string: *const c_char) -> *mut curl_slist;

    /// Free an entire curl_slist.
    ///
    /// # Safety
    /// `list` must have been created by `curl_slist_append` or be null.
    pub fn curl_slist_free_all(list: *mut curl_slist);

    // === Global Init ===

    /// Initialize libcurl globally. Must be called before any other function.
    ///
    /// # Safety
    /// Must be called from a single thread before any concurrent curl usage.
    pub fn curl_global_init(flags: c_long) -> CURLcode;

    /// Cleanup libcurl global state.
    ///
    /// # Safety
    /// Must be called after all curl handles are freed.
    pub fn curl_global_cleanup();

    // === curl-impersonate specific ===

    /// Set the browser to impersonate.
    ///
    /// # Safety
    /// `handle` must be valid. `target` must be a valid C string
    /// representing a supported browser (e.g., "chrome131", "safari17_0").
    pub fn curl_easy_impersonate(
        handle: *mut CURL,
        target: *const c_char,
        default_headers: c_int,
    ) -> CURLcode;

    // === Version ===

    /// Return the libcurl version string.
    ///
    /// # Safety
    /// Always safe to call.
    pub fn curl_version() -> *const c_char;

    // === WebSocket ===

    /// Send data on a WebSocket connection.
    pub fn curl_ws_send(
        handle: *mut CURL,
        buffer: *const c_void,
        buflen: usize,
        sent: *mut usize,
        fragsize: i64,
        flags: u32,
    ) -> CURLcode;

    /// Receive data from a WebSocket connection.
    pub fn curl_ws_recv(
        handle: *mut CURL,
        buffer: *mut c_void,
        buflen: usize,
        recv: *mut usize,
        metap: *mut *const curl_ws_frame,
    ) -> CURLcode;
}

// Global init flags
pub const CURL_GLOBAL_DEFAULT: c_long = 3; // CURL_GLOBAL_SSL | CURL_GLOBAL_WIN32
pub const CURL_GLOBAL_SSL: c_long = 1;
pub const CURL_GLOBAL_WIN32: c_long = 2;
pub const CURL_GLOBAL_ALL: c_long = 3;

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::CStr;

    // Note: These tests require the curl-impersonate library to be built.
    // They will only pass after Story 1.2 build is complete.

    #[test]
    fn test_curl_easy_init_cleanup() {
        unsafe {
            // SAFETY: curl_global_init is called before any handle creation
            let code = curl_global_init(CURL_GLOBAL_DEFAULT);
            assert_eq!(code, CURLE_OK, "curl_global_init failed");

            // SAFETY: curl_easy_init returns a new handle
            let handle = curl_easy_init();
            assert!(!handle.is_null(), "curl_easy_init returned null");

            // SAFETY: handle was created by curl_easy_init above
            curl_easy_cleanup(handle);

            // SAFETY: called after all handles are freed
            curl_global_cleanup();
        }
    }

    #[test]
    fn test_curl_version() {
        unsafe {
            // SAFETY: curl_version is always safe to call
            let version_ptr = curl_version();
            assert!(!version_ptr.is_null());

            // SAFETY: curl_version returns a valid static C string
            let version = CStr::from_ptr(version_ptr).to_str().unwrap();
            assert!(
                version.contains("curl") || version.contains("libcurl"),
                "Version string should contain 'curl': {}",
                version
            );
        }
    }

    #[test]
    fn test_curl_strerror() {
        unsafe {
            // SAFETY: curl_easy_strerror is always safe with any CURLcode
            let msg = curl_easy_strerror(CURLE_OK);
            assert!(!msg.is_null());
            let msg_str = CStr::from_ptr(msg).to_str().unwrap();
            assert!(!msg_str.is_empty());
        }
    }
}
