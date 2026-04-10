#[macro_use]
extern crate napi_derive;

pub mod curl;
pub mod ffi;
pub mod types;

use std::ffi::CStr;

/// A minimal hello function to verify the napi binding works correctly.
/// This will be replaced with actual curl bindings in subsequent stories.
#[napi]
pub fn hello() -> String {
    "Hello from curl-cffi-node native!".to_string()
}

/// Returns the version of the native module.
#[napi]
pub fn native_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Returns the libcurl version string from the linked curl-impersonate library.
#[napi]
pub fn curl_version() -> String {
    unsafe {
        // SAFETY: curl_version() is always safe to call and returns a static string
        let ptr = ffi::curl_version();
        if ptr.is_null() {
            return "unknown".to_string();
        }
        CStr::from_ptr(ptr).to_str().unwrap_or("invalid utf-8").to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hello() {
        assert_eq!(hello(), "Hello from curl-cffi-node native!");
    }

    #[test]
    fn test_native_version() {
        assert_eq!(native_version(), "0.1.0");
    }
}
