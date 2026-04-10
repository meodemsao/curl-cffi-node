//! Browser impersonation targets for curl-impersonate.
//!
//! Maps high-level browser identifiers to `curl_easy_impersonate()` target strings.
//! Target names must match those in curl-impersonate's `browsers.json`.

/// Supported browser impersonation targets.
///
/// Each variant maps to a specific browser version string accepted by
/// `curl_easy_impersonate()`.
#[napi(string_enum)]
#[derive(Debug)]
pub enum BrowserType {
    // ── Chrome ──────────────────────────────────────────────────────────
    /// Chrome 99 (Windows 10)
    #[napi(value = "chrome99")]
    Chrome99,
    /// Chrome 100 (Windows 10)
    #[napi(value = "chrome100")]
    Chrome100,
    /// Chrome 101 (Windows 10)
    #[napi(value = "chrome101")]
    Chrome101,
    /// Chrome 104 (Windows 10)
    #[napi(value = "chrome104")]
    Chrome104,
    /// Chrome 107 (Windows 10)
    #[napi(value = "chrome107")]
    Chrome107,
    /// Chrome 110 (Windows 10)
    #[napi(value = "chrome110")]
    Chrome110,
    /// Chrome 116 (Windows 10)
    #[napi(value = "chrome116")]
    Chrome116,

    // ── Chrome Android ─────────────────────────────────────────────────
    /// Chrome 99 (Android 12, Pixel 6)
    #[napi(value = "chrome99_android")]
    Chrome99Android,

    // ── Edge ────────────────────────────────────────────────────────────
    /// Edge 99 (Windows 10)
    #[napi(value = "edge99")]
    Edge99,
    /// Edge 101 (Windows 10)
    #[napi(value = "edge101")]
    Edge101,

    // ── Safari ──────────────────────────────────────────────────────────
    /// Safari 15.3 (macOS)
    #[napi(value = "safari15_3")]
    Safari15_3,
    /// Safari 15.5 (macOS)
    #[napi(value = "safari15_5")]
    Safari15_5,
}

impl BrowserType {
    /// Returns the curl-impersonate target string for this browser.
    pub fn to_target_str(&self) -> &'static str {
        match self {
            BrowserType::Chrome99 => "chrome99",
            BrowserType::Chrome100 => "chrome100",
            BrowserType::Chrome101 => "chrome101",
            BrowserType::Chrome104 => "chrome104",
            BrowserType::Chrome107 => "chrome107",
            BrowserType::Chrome110 => "chrome110",
            BrowserType::Chrome116 => "chrome116",
            BrowserType::Chrome99Android => "chrome99_android",
            BrowserType::Edge99 => "edge99",
            BrowserType::Edge101 => "edge101",
            BrowserType::Safari15_3 => "safari15_3",
            BrowserType::Safari15_5 => "safari15_5",
        }
    }
}
