//! Safe RAII wrapper around a libcurl easy handle.
//!
//! Provides the `Curl` N-API class with setopt/getinfo/perform methods.

use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_long, c_void};
use std::ptr;
use std::slice;
use std::sync::Once;

use napi::bindgen_prelude::*;

use crate::ffi;
use crate::types::curl_info::{CurlInfo, InfoType};
use crate::types::curl_opt::{CurlOpt, OptType};
use crate::types::impersonate::BrowserType;

static CURL_GLOBAL_INIT: Once = Once::new();

fn ensure_global_init() {
    CURL_GLOBAL_INIT.call_once(|| {
        // SAFETY: Called exactly once before any curl handle is created.
        unsafe {
            ffi::curl_global_init(ffi::CURL_GLOBAL_DEFAULT);
        }
    });
}

/// A libcurl easy handle with RAII cleanup.
///
/// When this object is garbage collected, `curl_easy_cleanup` is called
/// automatically, freeing all associated resources.
#[napi]
pub struct Curl {
    handle: *mut ffi::CURL,
    /// Holds CStrings alive for the lifetime of the handle, keyed by option.
    /// libcurl does NOT copy strings passed to setopt — they must stay valid.
    /// Using HashMap ensures old values are freed when replaced (P5 fix).
    pinned_strings: HashMap<ffi::CURLoption, CString>,
    /// Holds slists alive for the lifetime of the handle, keyed by option.
    pinned_slists: HashMap<ffi::CURLoption, *mut ffi::curl_slist>,
    /// Strings not tied to a specific option (e.g., impersonate target).
    extra_strings: Vec<CString>,
}

// SAFETY: The CURL handle is not used concurrently from multiple threads.
// Each Curl instance is only accessed from the JS main thread.
unsafe impl Send for Curl {}

impl Drop for Curl {
    fn drop(&mut self) {
        if !self.handle.is_null() {
            // SAFETY: handle was created by curl_easy_init
            unsafe {
                ffi::curl_easy_cleanup(self.handle);
            }
            self.handle = ptr::null_mut();
        }
        // Free all pinned slists
        for (_, slist) in self.pinned_slists.drain() {
            if !slist.is_null() {
                // SAFETY: slist was created by curl_slist_append
                unsafe {
                    ffi::curl_slist_free_all(slist);
                }
            }
        }
    }
}

#[napi]
impl Curl {
    /// Create a new Curl handle.
    ///
    /// Equivalent to `curl_easy_init()`.
    #[napi(constructor)]
    pub fn new() -> Result<Self> {
        ensure_global_init();

        // SAFETY: curl_global_init has been called above
        let handle = unsafe { ffi::curl_easy_init() };
        if handle.is_null() {
            return Err(Error::from_reason("Failed to initialize curl handle"));
        }

        Ok(Curl {
            handle,
            pinned_strings: HashMap::new(),
            pinned_slists: HashMap::new(),
            extra_strings: Vec::new(),
        })
    }

    /// Set a string option on the curl handle.
    ///
    /// @param opt - The CurlOpt option to set
    /// @param value - The string value
    #[napi]
    pub fn setopt_str(&mut self, opt: CurlOpt, value: String) -> Result<()> {
        match opt.option_type() {
            OptType::String => {}
            _ => {
                return Err(Error::from_reason(format!(
                    "{:?} is not a string option, use setopt_long or setopt_list",
                    opt
                )));
            }
        }

        let c_value = CString::new(value)
            .map_err(|e| Error::from_reason(format!("Invalid string value: {}", e)))?;

        // SAFETY: handle is valid, c_value is a valid CString.
        // We store c_value in pinned_strings keyed by option to keep it alive.
        // The old value (if any) is dropped AFTER setopt updates the pointer.
        let code = unsafe {
            ffi::curl_easy_setopt(self.handle, opt.to_ffi(), c_value.as_ptr())
        };

        // Insert replaces the old CString, which is now safe to drop because
        // libcurl's internal pointer has been updated to the new value.
        self.pinned_strings.insert(opt.to_ffi(), c_value);
        self.check_code(code)
    }

    /// Set a long/boolean option on the curl handle.
    ///
    /// @param opt - The CurlOpt option to set
    /// @param value - The numeric value (0/1 for booleans)
    #[napi]
    pub fn setopt_long(&mut self, opt: CurlOpt, value: i64) -> Result<()> {
        match opt.option_type() {
            OptType::Long => {}
            _ => {
                return Err(Error::from_reason(format!(
                    "{:?} is not a long option, use setopt_str or setopt_list",
                    opt
                )));
            }
        }

        // SAFETY: handle is valid, value is a c_long
        let code = unsafe {
            ffi::curl_easy_setopt(self.handle, opt.to_ffi(), value as c_long)
        };
        self.check_code(code)
    }

    /// Set a string-list option on the curl handle.
    ///
    /// @param opt - The CurlOpt option to set (HttpHeader, ProxyHeader, Resolve)
    /// @param values - Array of strings
    #[napi]
    pub fn setopt_list(&mut self, opt: CurlOpt, values: Vec<String>) -> Result<()> {
        match opt.option_type() {
            OptType::SList => {}
            _ => {
                return Err(Error::from_reason(format!(
                    "{:?} is not a list option, use setopt_str or setopt_long",
                    opt
                )));
            }
        }

        let mut slist: *mut ffi::curl_slist = ptr::null_mut();

        for v in &values {
            let c_str = CString::new(v.as_str())
                .map_err(|e| Error::from_reason(format!("Invalid header: {}", e)))?;

            // SAFETY: slist can be null (creates new list), c_str is valid
            slist = unsafe { ffi::curl_slist_append(slist, c_str.as_ptr()) };

            if slist.is_null() {
                return Err(Error::from_reason("Failed to append to slist"));
            }

            // CString is copied by curl_slist_append, so it can be dropped
        }

        // SAFETY: handle is valid, slist is a valid curl_slist
        let code = unsafe {
            ffi::curl_easy_setopt(self.handle, opt.to_ffi(), slist)
        };

        // Free the old slist for this option (if any) — it's no longer
        // referenced by libcurl because setopt replaced the pointer.
        let opt_key = opt.to_ffi();
        if let Some(old_slist) = self.pinned_slists.remove(&opt_key) {
            if !old_slist.is_null() {
                unsafe { ffi::curl_slist_free_all(old_slist); }
            }
        }
        self.pinned_slists.insert(opt_key, slist);
        self.check_code(code)
    }

    /// Get info from the curl handle after a transfer.
    ///
    /// Returns a JSON-compatible value (number, string, or null).
    ///
    /// @param info - The CurlInfo key to retrieve
    #[napi]
    pub fn getinfo(&self, info: CurlInfo) -> Result<napi::Either<f64, String>> {
        match info.info_type() {
            InfoType::Long => {
                let mut value: c_long = 0;
                // SAFETY: handle is valid, value pointer is valid
                let code = unsafe {
                    ffi::curl_easy_getinfo(self.handle, info.to_ffi(), &mut value)
                };
                self.check_code(code)?;
                Ok(napi::Either::A(value as f64))
            }
            InfoType::Double => {
                let mut value: f64 = 0.0;
                // SAFETY: handle is valid, value pointer is valid
                let code = unsafe {
                    ffi::curl_easy_getinfo(self.handle, info.to_ffi(), &mut value)
                };
                self.check_code(code)?;
                Ok(napi::Either::A(value))
            }
            InfoType::String => {
                let mut ptr: *const std::os::raw::c_char = ptr::null();
                // SAFETY: handle is valid, ptr is a valid pointer-to-pointer
                let code = unsafe {
                    ffi::curl_easy_getinfo(self.handle, info.to_ffi(), &mut ptr)
                };
                self.check_code(code)?;

                if ptr.is_null() {
                    Ok(napi::Either::B(String::new()))
                } else {
                    // SAFETY: ptr is a valid C string owned by curl
                    let s = unsafe { CStr::from_ptr(ptr) }
                        .to_str()
                        .unwrap_or("")
                        .to_string();
                    Ok(napi::Either::B(s))
                }
            }
        }
    }

    // ─── Cookie Engine ──────────────────────────────────────────────────────

    /// Enable the in-memory cookie engine.
    ///
    /// Must be called before perform to enable cookie persistence.
    #[napi]
    pub fn enable_cookies(&mut self) -> Result<()> {
        let empty = CString::new("").unwrap();
        let code = unsafe {
            ffi::curl_easy_setopt(self.handle, ffi::CURLOPT_COOKIEFILE, empty.as_ptr())
        };
        self.pinned_strings.insert(ffi::CURLOPT_COOKIEFILE, empty);
        self.check_code(code)
    }

    /// Get all cookies from the cookie engine as Netscape-format strings.
    #[napi]
    pub fn get_cookies(&self) -> Result<Vec<String>> {
        // Flush cookies to ensure all are readable
        let flush = CString::new("FLUSH").unwrap();
        unsafe {
            ffi::curl_easy_setopt(self.handle, ffi::CURLOPT_COOKIELIST, flush.as_ptr());
        }

        let mut slist_ptr: *mut ffi::curl_slist = ptr::null_mut();
        unsafe {
            ffi::curl_easy_getinfo(
                self.handle,
                ffi::CURLINFO_COOKIELIST,
                &mut slist_ptr,
            );
        }

        let mut cookies = Vec::new();
        let mut current = slist_ptr;
        while !current.is_null() {
            let entry = unsafe { &*current };
            if !entry.data.is_null() {
                let s = unsafe { CStr::from_ptr(entry.data) }
                    .to_str()
                    .unwrap_or("")
                    .to_string();
                cookies.push(s);
            }
            current = entry.next;
        }

        // Free the slist returned by getinfo
        if !slist_ptr.is_null() {
            unsafe { ffi::curl_slist_free_all(slist_ptr) };
        }

        Ok(cookies)
    }

    /// Add a cookie to the cookie engine in Netscape format.
    ///
    /// Format: ".domain.com\tTRUE\t/\tFALSE\t0\tname\tvalue"
    #[napi]
    pub fn add_cookie(&mut self, cookie_line: String) -> Result<()> {
        let c_cookie = CString::new(cookie_line)
            .map_err(|e| Error::from_reason(format!("Invalid cookie: {}", e)))?;
        let code = unsafe {
            ffi::curl_easy_setopt(self.handle, ffi::CURLOPT_COOKIELIST, c_cookie.as_ptr())
        };
        // CookieList strings are copied by libcurl, no need to pin
        self.check_code(code)
    }

    /// Clear all cookies from the cookie engine.
    #[napi]
    pub fn clear_cookies(&mut self) -> Result<()> {
        let all = CString::new("ALL").unwrap();
        let code = unsafe {
            ffi::curl_easy_setopt(self.handle, ffi::CURLOPT_COOKIELIST, all.as_ptr())
        };
        self.check_code(code)
    }

    // ─── Impersonation ───────────────────────────────────────────────────────

    /// Set browser impersonation using a BrowserType enum value.
    ///
    /// This configures the TLS ClientHello, HTTP/2 settings, and default headers
    /// to match the specified browser version.
    ///
    /// @param browser - The BrowserType to impersonate
    /// @param default_headers - Whether to apply default browser headers (default: true)
    #[napi]
    pub fn impersonate(&mut self, browser: BrowserType, default_headers: Option<bool>) -> Result<()> {
        let target = browser.to_target_str();
        self.impersonate_internal(target, default_headers.unwrap_or(true))
    }

    /// Set browser impersonation using a raw string target.
    ///
    /// For advanced use cases where a custom or newer browser identifier is needed.
    ///
    /// @param target - The browser target string (e.g., "chrome131.0")
    /// @param default_headers - Whether to apply default browser headers (default: true)
    #[napi]
    pub fn impersonate_str(&mut self, target: String, default_headers: Option<bool>) -> Result<()> {
        self.impersonate_internal(&target, default_headers.unwrap_or(true))
    }

    fn impersonate_internal(&mut self, target: &str, default_headers: bool) -> Result<()> {
        let c_target = CString::new(target)
            .map_err(|e| Error::from_reason(format!("Invalid browser target: {}", e)))?;

        // SAFETY: handle is valid, c_target is a valid CString
        let code = unsafe {
            ffi::curl_easy_impersonate(
                self.handle,
                c_target.as_ptr(),
                if default_headers { 1 } else { 0 },
            )
        };

        self.extra_strings.push(c_target);
        self.check_code(code)
    }

    // ─── Perform ─────────────────────────────────────────────────────────────

    /// Perform a synchronous HTTP request.
    ///
    /// Executes the request and returns the body, headers, and status code.
    /// The curl handle is blocked until the response is fully received.
    ///
    /// @returns PerformResult with body (Buffer), headers (string), statusCode
    #[napi]
    pub fn perform(&mut self) -> Result<PerformResult> {
        let mut body_buf: Vec<u8> = Vec::new();
        let mut header_buf: Vec<u8> = Vec::new();

        // SAFETY: We pass mutable references as user data pointers.
        // They are only accessed within the callbacks during curl_easy_perform.
        unsafe {
            ffi::curl_easy_setopt(
                self.handle,
                ffi::CURLOPT_WRITEFUNCTION,
                write_callback as *const c_void,
            );
            ffi::curl_easy_setopt(
                self.handle,
                ffi::CURLOPT_WRITEDATA,
                &mut body_buf as *mut Vec<u8> as *mut c_void,
            );
            ffi::curl_easy_setopt(
                self.handle,
                ffi::CURLOPT_HEADERFUNCTION,
                header_callback as *const c_void,
            );
            ffi::curl_easy_setopt(
                self.handle,
                ffi::CURLOPT_HEADERDATA,
                &mut header_buf as *mut Vec<u8> as *mut c_void,
            );
        }

        // SAFETY: handle is valid with URL set
        let code = unsafe { ffi::curl_easy_perform(self.handle) };

        if code != ffi::CURLE_OK {
            let msg = self.strerror(code);
            return Err(Error::from_reason(format!(
                "curl error ({}): {}",
                code, msg
            )));
        }

        // Get status code
        let mut status_code: c_long = 0;
        unsafe {
            ffi::curl_easy_getinfo(
                self.handle,
                ffi::CURLINFO_RESPONSE_CODE,
                &mut status_code,
            );
        }

        // Get effective URL
        let mut effective_url_ptr: *const c_char = ptr::null();
        unsafe {
            ffi::curl_easy_getinfo(
                self.handle,
                ffi::CURLINFO_EFFECTIVE_URL,
                &mut effective_url_ptr,
            );
        }
        let effective_url = if effective_url_ptr.is_null() {
            String::new()
        } else {
            unsafe { CStr::from_ptr(effective_url_ptr) }
                .to_str()
                .unwrap_or("")
                .to_string()
        };

        // Parse headers
        let headers_str = String::from_utf8_lossy(&header_buf).to_string();

        // Extract timing info
        let (dns_time_ms, connect_time_ms, tls_time_ms, total_time_ms) =
            extract_timing(self.handle);

        Ok(PerformResult {
            body: body_buf.into(),
            headers: headers_str,
            status_code: status_code as i32,
            effective_url,
            dns_time_ms,
            connect_time_ms,
            tls_time_ms,
            total_time_ms,
        })
    }

    /// Perform an asynchronous HTTP request.
    ///
    /// Duplicates the handle and runs `curl_easy_perform` on a libuv thread pool
    /// worker. The Node.js event loop is NOT blocked during the request.
    ///
    /// @returns Promise<PerformResult>
    #[napi]
    pub fn perform_async(&self) -> AsyncTask<CurlPerformTask> {
        // SAFETY: handle is valid — duphandle copies all options
        let dup_handle = unsafe { ffi::curl_easy_duphandle(self.handle) };

        AsyncTask::new(CurlPerformTask {
            handle: dup_handle,
        })
    }

    // ─── WebSocket ──────────────────────────────────────────────────────

    /// Connect to a WebSocket server.
    ///
    /// Sets CONNECT_ONLY=2 and performs the upgrade handshake.
    /// After this returns, use wsSend/wsRecv for messaging.
    #[napi]
    pub fn ws_connect(&mut self) -> Result<()> {
        // Set CONNECT_ONLY=2 for WebSocket mode
        let code = unsafe {
            ffi::curl_easy_setopt(self.handle, ffi::CURLOPT_CONNECT_ONLY, 2 as c_long)
        };
        self.check_code(code)?;

        // Perform the upgrade handshake
        let code = unsafe { ffi::curl_easy_perform(self.handle) };
        if code != ffi::CURLE_OK {
            let msg = self.strerror(code);
            return Err(Error::from_reason(format!(
                "WebSocket connect error ({}): {}",
                code, msg
            )));
        }
        Ok(())
    }

    /// Send data on a WebSocket connection.
    ///
    /// @param data - Binary data to send
    /// @param flags - CURLWS_TEXT (1) or CURLWS_BINARY (2) or CURLWS_CLOSE (8)
    #[napi]
    pub fn ws_send(&self, data: Buffer, flags: u32) -> Result<()> {
        let mut sent: usize = 0;
        let code = unsafe {
            ffi::curl_ws_send(
                self.handle,
                data.as_ptr() as *const c_void,
                data.len(),
                &mut sent,
                0, // fragsize = 0 means complete message
                flags,
            )
        };
        if code != ffi::CURLE_OK {
            let msg = self.strerror(code);
            return Err(Error::from_reason(format!(
                "WebSocket send error ({}): {}",
                code, msg
            )));
        }
        Ok(())
    }

    /// Receive one frame from a WebSocket connection.
    ///
    /// Returns { data: Buffer, flags: number } or null if connection closed.
    /// Call this in a loop to read all incoming messages.
    #[napi]
    pub fn ws_recv(&self, buffer_size: Option<u32>) -> Result<Option<WsFrame>> {
        let buf_size = buffer_size.unwrap_or(65536) as usize;
        let mut buf = vec![0u8; buf_size];
        let mut recv_len: usize = 0;
        let mut meta_ptr: *const ffi::curl_ws_frame = ptr::null();

        let code = unsafe {
            ffi::curl_ws_recv(
                self.handle,
                buf.as_mut_ptr() as *mut c_void,
                buf_size,
                &mut recv_len,
                &mut meta_ptr,
            )
        };

        // CURLE_AGAIN (81) means no data available yet
        if code == 81 {
            return Ok(None);
        }

        if code != ffi::CURLE_OK {
            let msg = self.strerror(code);
            return Err(Error::from_reason(format!(
                "WebSocket recv error ({}): {}",
                code, msg
            )));
        }

        let flags = if !meta_ptr.is_null() {
            unsafe { (*meta_ptr).flags as u32 }
        } else {
            0
        };

        buf.truncate(recv_len);

        Ok(Some(WsFrame {
            data: Buffer::from(buf),
            flags,
        }))
    }

    /// Reset all options to defaults, allowing handle reuse.
    #[napi]
    pub fn reset(&mut self) {
        // SAFETY: handle is valid
        unsafe {
            ffi::curl_easy_reset(self.handle);
        }
        self.pinned_strings.clear();
        self.extra_strings.clear();
        // Free all pinned slists
        for (_, slist) in self.pinned_slists.drain() {
            if !slist.is_null() {
                unsafe {
                    ffi::curl_slist_free_all(slist);
                }
            }
        }
    }

    /// Clone this curl handle with all its options.
    #[napi]
    pub fn duplicate(&self) -> Result<Curl> {
        // SAFETY: handle is valid
        let new_handle = unsafe { ffi::curl_easy_duphandle(self.handle) };
        if new_handle.is_null() {
            return Err(Error::from_reason("Failed to duplicate curl handle"));
        }
        Ok(Curl {
            handle: new_handle,
            pinned_strings: HashMap::new(),
            pinned_slists: HashMap::new(),
            extra_strings: Vec::new(),
        })
    }

    /// Get a human-readable error description for the last error code.
    #[napi]
    pub fn strerror(&self, code: i32) -> String {
        // SAFETY: curl_easy_strerror is always safe to call
        let ptr = unsafe { ffi::curl_easy_strerror(code) };
        if ptr.is_null() {
            return "Unknown error".to_string();
        }
        unsafe { CStr::from_ptr(ptr) }
            .to_str()
            .unwrap_or("Unknown error")
            .to_string()
    }

    /// Convert a CURLcode to a Result, producing a descriptive error on failure.
    fn check_code(&self, code: ffi::CURLcode) -> Result<()> {
        if code == ffi::CURLE_OK {
            Ok(())
        } else {
            let msg = self.strerror(code);
            Err(Error::from_reason(format!(
                "curl error ({}): {}",
                code, msg
            )))
        }
    }

    /// Get the raw CURL* handle (for internal use in perform, etc.)
    pub(crate) fn raw(&self) -> *mut ffi::CURL {
        self.handle
    }
}

/// Result of a synchronous `Curl.perform()` call.
#[napi(object)]
pub struct PerformResult {
    /// Response body as a Buffer.
    pub body: Buffer,
    /// Raw response headers as a string (each header line separated by \r\n).
    pub headers: String,
    /// HTTP status code (e.g., 200, 404, 500).
    pub status_code: i32,
    /// The effective URL after any redirects.
    pub effective_url: String,
    /// DNS resolution time in milliseconds.
    pub dns_time_ms: f64,
    /// TCP connection time in milliseconds.
    pub connect_time_ms: f64,
    /// TLS handshake time in milliseconds.
    pub tls_time_ms: f64,
    /// Total request time in milliseconds.
    pub total_time_ms: f64,
}

/// WebSocket frame received from wsRecv().
#[napi(object)]
pub struct WsFrame {
    /// Frame payload data.
    pub data: Buffer,
    /// Frame flags (CURLWS_TEXT=1, CURLWS_BINARY=2, CURLWS_CLOSE=8).
    pub flags: u32,
}

/// C callback for CURLOPT_WRITEFUNCTION — appends data to a Vec<u8>.
///
/// Called by libcurl for each chunk of response body data.
/// Returns the number of bytes processed; returning less than `nmemb * size`
/// signals an error to curl.
///
/// # Safety
/// `userdata` must be a valid `*mut Vec<u8>`.
unsafe extern "C" fn write_callback(
    data: *mut c_char,
    size: usize,
    nmemb: usize,
    userdata: *mut c_void,
) -> usize {
    let realsize = size * nmemb;
    if realsize == 0 || data.is_null() || userdata.is_null() {
        return 0;
    }

    // SAFETY: userdata was set to &mut Vec<u8> in perform()
    let buf = &mut *(userdata as *mut Vec<u8>);
    // SAFETY: data + realsize is within the buffer provided by curl
    let bytes = slice::from_raw_parts(data as *const u8, realsize);
    buf.extend_from_slice(bytes);
    realsize
}

/// C callback for CURLOPT_HEADERFUNCTION — appends header data to a Vec<u8>.
///
/// Called by libcurl for each header line in the response.
///
/// # Safety
/// `userdata` must be a valid `*mut Vec<u8>`.
unsafe extern "C" fn header_callback(
    data: *mut c_char,
    size: usize,
    nmemb: usize,
    userdata: *mut c_void,
) -> usize {
    let realsize = size * nmemb;
    if realsize == 0 || data.is_null() || userdata.is_null() {
        return 0;
    }

    // SAFETY: userdata was set to &mut Vec<u8> in perform()
    let buf = &mut *(userdata as *mut Vec<u8>);
    // SAFETY: data + realsize is within the buffer provided by curl
    let bytes = slice::from_raw_parts(data as *const u8, realsize);
    buf.extend_from_slice(bytes);
    realsize
}

/// Extract timing info from a curl handle after a transfer.
fn extract_timing(handle: *mut ffi::CURL) -> (f64, f64, f64, f64) {
    let mut dns: f64 = 0.0;
    let mut connect: f64 = 0.0;
    let mut tls: f64 = 0.0;
    let mut total: f64 = 0.0;
    unsafe {
        ffi::curl_easy_getinfo(handle, ffi::CURLINFO_NAMELOOKUP_TIME, &mut dns);
        ffi::curl_easy_getinfo(handle, ffi::CURLINFO_CONNECT_TIME, &mut connect);
        ffi::curl_easy_getinfo(handle, ffi::CURLINFO_APPCONNECT_TIME, &mut tls);
        ffi::curl_easy_getinfo(handle, ffi::CURLINFO_TOTAL_TIME, &mut total);
    }
    // Convert from seconds to milliseconds
    (dns * 1000.0, connect * 1000.0, tls * 1000.0, total * 1000.0)
}

// ─── Async Task ──────────────────────────────────────────────────────────────

/// Raw result from the thread pool before conversion to napi types.
pub struct RawPerformResult {
    body: Vec<u8>,
    headers: String,
    status_code: i32,
    effective_url: String,
    dns_time_ms: f64,
    connect_time_ms: f64,
    tls_time_ms: f64,
    total_time_ms: f64,
}

/// Wrapper around a raw CURL handle for thread pool execution.
///
/// This struct owns a duplicated CURL handle and is safe to Send to a
/// worker thread. The handle is cleaned up after the task completes.
pub struct CurlPerformTask {
    handle: *mut ffi::CURL,
}

// SAFETY: The duplicated handle is exclusively owned by this task.
// No other code accesses it while it's on the worker thread.
unsafe impl Send for CurlPerformTask {}

impl napi::Task for CurlPerformTask {
    type Output = RawPerformResult;
    type JsValue = PerformResult;

    /// Runs on libuv thread pool — NOT on the main JS thread.
    fn compute(&mut self) -> Result<Self::Output> {
        if self.handle.is_null() {
            return Err(Error::from_reason(
                "Failed to duplicate curl handle for async perform",
            ));
        }

        let mut body_buf: Vec<u8> = Vec::new();
        let mut header_buf: Vec<u8> = Vec::new();

        // SAFETY: handle is exclusively owned by this task on this thread.
        unsafe {
            ffi::curl_easy_setopt(
                self.handle,
                ffi::CURLOPT_WRITEFUNCTION,
                write_callback as *const c_void,
            );
            ffi::curl_easy_setopt(
                self.handle,
                ffi::CURLOPT_WRITEDATA,
                &mut body_buf as *mut Vec<u8> as *mut c_void,
            );
            ffi::curl_easy_setopt(
                self.handle,
                ffi::CURLOPT_HEADERFUNCTION,
                header_callback as *const c_void,
            );
            ffi::curl_easy_setopt(
                self.handle,
                ffi::CURLOPT_HEADERDATA,
                &mut header_buf as *mut Vec<u8> as *mut c_void,
            );
        }

        // This blocks the worker thread (not the JS event loop)
        let code = unsafe { ffi::curl_easy_perform(self.handle) };

        if code != ffi::CURLE_OK {
            let ptr = unsafe { ffi::curl_easy_strerror(code) };
            let msg = if ptr.is_null() {
                "Unknown error".to_string()
            } else {
                unsafe { CStr::from_ptr(ptr) }
                    .to_str()
                    .unwrap_or("Unknown error")
                    .to_string()
            };
            // Clean up handle before returning error
            unsafe { ffi::curl_easy_cleanup(self.handle) };
            self.handle = ptr::null_mut();
            return Err(Error::from_reason(format!(
                "curl error ({}): {}",
                code, msg
            )));
        }

        // Get status code
        let mut status_code: c_long = 0;
        unsafe {
            ffi::curl_easy_getinfo(
                self.handle,
                ffi::CURLINFO_RESPONSE_CODE,
                &mut status_code,
            );
        }

        // Get effective URL
        let mut effective_url_ptr: *const c_char = ptr::null();
        unsafe {
            ffi::curl_easy_getinfo(
                self.handle,
                ffi::CURLINFO_EFFECTIVE_URL,
                &mut effective_url_ptr,
            );
        }
        let effective_url = if effective_url_ptr.is_null() {
            String::new()
        } else {
            unsafe { CStr::from_ptr(effective_url_ptr) }
                .to_str()
                .unwrap_or("")
                .to_string()
        };

        let headers_str = String::from_utf8_lossy(&header_buf).to_string();

        // Extract timing
        let (dns_time_ms, connect_time_ms, tls_time_ms, total_time_ms) =
            extract_timing(self.handle);

        // Clean up
        unsafe { ffi::curl_easy_cleanup(self.handle) };
        self.handle = ptr::null_mut();

        Ok(RawPerformResult {
            body: body_buf,
            headers: headers_str,
            status_code: status_code as i32,
            effective_url,
            dns_time_ms,
            connect_time_ms,
            tls_time_ms,
            total_time_ms,
        })
    }

    /// Runs on the main JS thread — converts raw result to napi types.
    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(PerformResult {
            body: output.body.into(),
            headers: output.headers,
            status_code: output.status_code,
            effective_url: output.effective_url,
            dns_time_ms: output.dns_time_ms,
            connect_time_ms: output.connect_time_ms,
            tls_time_ms: output.tls_time_ms,
            total_time_ms: output.total_time_ms,
        })
    }
}

impl Drop for CurlPerformTask {
    fn drop(&mut self) {
        if !self.handle.is_null() {
            unsafe { ffi::curl_easy_cleanup(self.handle) };
            self.handle = ptr::null_mut();
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::ffi;
    use std::ffi::CString;
    use std::ptr;
    use std::sync::Once;

    static INIT: Once = Once::new();

    fn init() {
        INIT.call_once(|| unsafe {
            ffi::curl_global_init(ffi::CURL_GLOBAL_DEFAULT);
        });
    }

    #[test]
    fn test_curl_handle_create_cleanup() {
        init();
        unsafe {
            // SAFETY: curl_global_init has been called
            let handle = ffi::curl_easy_init();
            assert!(!handle.is_null());
            ffi::curl_easy_cleanup(handle);
        }
    }

    #[test]
    fn test_curl_setopt_url() {
        init();
        unsafe {
            let handle = ffi::curl_easy_init();
            assert!(!handle.is_null());

            let url = CString::new("https://httpbin.org/get").unwrap();
            let code = ffi::curl_easy_setopt(handle, ffi::CURLOPT_URL, url.as_ptr());
            assert_eq!(code, ffi::CURLE_OK, "setopt URL failed");

            ffi::curl_easy_cleanup(handle);
        }
    }

    #[test]
    fn test_curl_setopt_long_options() {
        init();
        unsafe {
            let handle = ffi::curl_easy_init();
            assert!(!handle.is_null());

            let code = ffi::curl_easy_setopt(handle, ffi::CURLOPT_FOLLOWLOCATION, 1i64);
            assert_eq!(code, ffi::CURLE_OK);

            let code = ffi::curl_easy_setopt(handle, ffi::CURLOPT_MAXREDIRS, 10i64);
            assert_eq!(code, ffi::CURLE_OK);

            let code = ffi::curl_easy_setopt(handle, ffi::CURLOPT_TIMEOUT_MS, 30000i64);
            assert_eq!(code, ffi::CURLE_OK);

            ffi::curl_easy_cleanup(handle);
        }
    }

    #[test]
    fn test_curl_setopt_headers_slist() {
        init();
        unsafe {
            let handle = ffi::curl_easy_init();
            assert!(!handle.is_null());

            let h1 = CString::new("Accept: application/json").unwrap();
            let h2 = CString::new("X-Custom: test").unwrap();

            let mut slist: *mut ffi::curl_slist = ptr::null_mut();
            slist = ffi::curl_slist_append(slist, h1.as_ptr());
            assert!(!slist.is_null());
            slist = ffi::curl_slist_append(slist, h2.as_ptr());
            assert!(!slist.is_null());

            let code = ffi::curl_easy_setopt(handle, ffi::CURLOPT_HTTPHEADER, slist);
            assert_eq!(code, ffi::CURLE_OK);

            ffi::curl_slist_free_all(slist);
            ffi::curl_easy_cleanup(handle);
        }
    }

    #[test]
    fn test_curl_reset() {
        init();
        unsafe {
            let handle = ffi::curl_easy_init();
            assert!(!handle.is_null());

            let url = CString::new("https://example.com").unwrap();
            ffi::curl_easy_setopt(handle, ffi::CURLOPT_URL, url.as_ptr());

            ffi::curl_easy_reset(handle);

            let url2 = CString::new("https://example.org").unwrap();
            let code = ffi::curl_easy_setopt(handle, ffi::CURLOPT_URL, url2.as_ptr());
            assert_eq!(code, ffi::CURLE_OK);

            ffi::curl_easy_cleanup(handle);
        }
    }

    #[test]
    fn test_curl_duphandle() {
        init();
        unsafe {
            let handle = ffi::curl_easy_init();
            assert!(!handle.is_null());

            let url = CString::new("https://example.com").unwrap();
            ffi::curl_easy_setopt(handle, ffi::CURLOPT_URL, url.as_ptr());

            let dup = ffi::curl_easy_duphandle(handle);
            assert!(!dup.is_null());
            assert_ne!(handle, dup);

            ffi::curl_easy_cleanup(dup);
            ffi::curl_easy_cleanup(handle);
        }
    }

    #[test]
    fn test_curl_perform_get() {
        init();
        unsafe {
            let handle = ffi::curl_easy_init();
            assert!(!handle.is_null());

            let url = CString::new("https://httpbin.org/get").unwrap();
            ffi::curl_easy_setopt(handle, ffi::CURLOPT_URL, url.as_ptr());
            ffi::curl_easy_setopt(handle, ffi::CURLOPT_TIMEOUT_MS, 10000i64);

            // Set up write callback
            let mut body: Vec<u8> = Vec::new();
            ffi::curl_easy_setopt(
                handle,
                ffi::CURLOPT_WRITEFUNCTION,
                super::write_callback as *const std::ffi::c_void,
            );
            ffi::curl_easy_setopt(
                handle,
                ffi::CURLOPT_WRITEDATA,
                &mut body as *mut Vec<u8> as *mut std::ffi::c_void,
            );

            let code = ffi::curl_easy_perform(handle);
            assert_eq!(code, ffi::CURLE_OK, "perform failed with code {}", code);

            // Check body is non-empty
            assert!(!body.is_empty(), "Response body is empty");

            // Check status code
            let mut status: std::os::raw::c_long = 0;
            ffi::curl_easy_getinfo(handle, ffi::CURLINFO_RESPONSE_CODE, &mut status);
            assert_eq!(status, 200, "Expected 200, got {}", status);

            // Parse body
            let body_str = String::from_utf8_lossy(&body);
            assert!(body_str.contains("httpbin.org"), "Body should contain httpbin.org");

            ffi::curl_easy_cleanup(handle);
        }
    }
}
