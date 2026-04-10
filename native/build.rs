use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

fn main() {
    napi_build::setup();

    let _out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let project_root = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap())
        .parent()
        .unwrap()
        .to_path_buf();
    let curl_imp_dir = project_root.join("curl-impersonate");

    // Check if prebuilt libs exist (CI scenario)
    let prebuilt_dir = project_root.join("prebuilt").join(target_triple());
    if prebuilt_dir.exists() && prebuilt_dir.join("lib").join("libcurl-impersonate.a").exists() {
        println!("cargo:warning=Using prebuilt libraries from {:?}", prebuilt_dir);
        link_prebuilt(&prebuilt_dir);
        return;
    }

    // Build from source
    if !curl_imp_dir.join("Makefile.in").exists() {
        panic!(
            "curl-impersonate submodule not found at {:?}. \
             Run: git submodule update --init --recursive",
            curl_imp_dir
        );
    }

    // Use a persistent build directory in target/ that survives `cargo clean -p`
    // OUT_DIR gets deleted on clean, but we don't want to rebuild curl-impersonate every time
    let target_dir = project_root.join("target");
    let build_dir = target_dir.join("curl-impersonate-build");
    std::fs::create_dir_all(&build_dir).expect("Failed to create build directory");

    // Augment PATH for child processes
    let augmented_path = augment_path();

    // Step 1: Run configure if Makefile doesn't exist
    if !build_dir.join("Makefile").exists() {
        println!("cargo:warning=Configuring curl-impersonate...");
        let configure = curl_imp_dir.join("configure");

        // Make configure executable
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = std::fs::metadata(&configure) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o755);
                let _ = std::fs::set_permissions(&configure, perms);
            }
        }

        // Run autoconf if configure doesn't exist
        if !configure.exists() {
            let status = Command::new("autoreconf")
                .args(["-fi"])
                .current_dir(&curl_imp_dir)
                .env("PATH", &augmented_path)
                .status()
                .expect("autoreconf failed. Install: brew install autoconf automake");
            assert!(status.success(), "autoreconf failed");
        }

        let status = Command::new(configure.to_str().unwrap())
            .args([
                &format!("--prefix={}", build_dir.join("installed").display()),
            ])
            .current_dir(&build_dir)
            .env("PATH", &augmented_path)
            .status()
            .expect("Failed to run configure");
        assert!(status.success(), "configure failed");
    }

    // Step 2: Build using GNU Make 4.0+ (curl-impersonate uses .ONESHELL)
    // Check if build is already done (sentinel: curl lib exists)
    let curl_lib_sentinel = build_dir.join("curl-8_15_0").join("lib").join(".libs").join("libcurl-impersonate.a");
    if !curl_lib_sentinel.exists() {
        println!("cargo:warning=Building curl-impersonate (this may take several minutes on first build)...");
        let make_cmd = find_make();

        // No -j flag: curl-impersonate's Makefile downloads and extracts archives
        // in the same recipe, which causes race conditions with parallel build.
        // SUBJOBS controls parallelism within each sub-build (BoringSSL, etc.)
        let num_jobs = num_cpus();
        let output = Command::new(&make_cmd)
            .args(["build", &format!("SUBJOBS={}", num_jobs)])
            .current_dir(&build_dir)
            .env("PATH", &augmented_path)
            .output()
            .expect("Failed to run make. Install: brew install make cmake ninja golang");

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            panic!(
                "make build failed!\n--- stdout (last 2000 chars) ---\n{}\n--- stderr (last 2000 chars) ---\n{}",
                &stdout[stdout.len().saturating_sub(2000)..],
                &stderr[stderr.len().saturating_sub(2000)..]
            );
        }

        // Remove dynamic libraries to force static linking
        remove_dynamic_libs(&build_dir);
    } else {
        println!("cargo:warning=curl-impersonate already built, skipping...");
        // Still ensure dynamic libs are removed
        remove_dynamic_libs(&build_dir);
    }

    // Step 3: Find and link the built libraries
    link_from_build_dir(&build_dir);

    // Rebuild if build.rs changes
    println!("cargo:rerun-if-changed=build.rs");
}

/// Remove all dynamic library files (.dylib, .so) from the build tree
/// to force the linker to use static libraries only.
fn remove_dynamic_libs(build_dir: &Path) {
    fn remove_recursive(dir: &Path) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_dir() {
                    remove_recursive(&path);
                } else if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.ends_with(".dylib") || name.ends_with(".so") ||
                       name.contains(".so.") || name.ends_with(".la") {
                        let _ = std::fs::remove_file(&path);
                    }
                }
            }
        }
    }
    remove_recursive(build_dir);
    println!("cargo:warning=Removed dynamic libraries to force static linking");
}

/// Augment the PATH with common tool locations
fn augment_path() -> String {
    let current_path = env::var("PATH").unwrap_or_default();
    let extra_paths = [
        "/opt/homebrew/bin",
        "/opt/homebrew/opt/go/bin",
        "/opt/homebrew/opt/make/libexec/gnubin",
        "/usr/local/bin",
        "/usr/local/go/bin",
    ];
    let mut parts: Vec<&str> = extra_paths.to_vec();
    parts.push(&current_path);
    parts.join(":")
}

/// Link pre-built static libraries (used in CI or when prebuilt/ directory exists)
fn link_prebuilt(prebuilt_dir: &Path) {
    let lib_dir = prebuilt_dir.join("lib");
    println!("cargo:rustc-link-search=native={}", lib_dir.display());
    link_curl_libs();
}

/// Link libraries from the curl-impersonate build output
fn link_from_build_dir(build_dir: &Path) {
    // BoringSSL
    let boringssl_dirs: Vec<_> = std::fs::read_dir(build_dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_name().to_str().unwrap_or("").starts_with("boringssl"))
        .collect();

    for entry in &boringssl_dirs {
        let p = entry.path();
        let lib = p.join("lib");
        if lib.exists() {
            println!("cargo:rustc-link-search=native={}", lib.display());
        }
    }

    // All other libraries with installed/ pattern
    for entry in std::fs::read_dir(build_dir).unwrap().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_dir() { continue; }

        // installed/lib (nghttp2, ngtcp2, nghttp3, zlib, zstd)
        let installed = path.join("installed").join("lib");
        if installed.exists() {
            println!("cargo:rustc-link-search=native={}", installed.display());
        }

        // out/installed/lib (brotli)
        let out_installed = path.join("out").join("installed").join("lib");
        if out_installed.exists() {
            println!("cargo:rustc-link-search=native={}", out_installed.display());
        }
    }

    // curl lib/.libs
    for entry in std::fs::read_dir(build_dir).unwrap().filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = path.file_name().unwrap().to_str().unwrap_or("");
        if name.starts_with("curl-") {
            let libs_dir = path.join("lib").join(".libs");
            if libs_dir.exists() {
                println!("cargo:rustc-link-search=native={}", libs_dir.display());
            }
        }
    }

    // ngtcp2 crypto boringssl
    for entry in std::fs::read_dir(build_dir).unwrap().filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = path.file_name().unwrap().to_str().unwrap_or("");
        if name.starts_with("ngtcp2-") {
            let crypto_dir = path.join("crypto").join("boringssl");
            if crypto_dir.exists() {
                println!("cargo:rustc-link-search=native={}", crypto_dir.display());
            }
        }
    }

    link_curl_libs();
}

/// Emit link instructions for all curl-impersonate static libraries
fn link_curl_libs() {
    // libcurl-impersonate (the patched curl)
    println!("cargo:rustc-link-lib=static=curl-impersonate");

    // BoringSSL
    println!("cargo:rustc-link-lib=static=ssl");
    println!("cargo:rustc-link-lib=static=crypto");

    // HTTP/2
    println!("cargo:rustc-link-lib=static=nghttp2");

    // HTTP/3 (QUIC)
    println!("cargo:rustc-link-lib=static=ngtcp2");
    println!("cargo:rustc-link-lib=static=ngtcp2_crypto_boringssl");
    println!("cargo:rustc-link-lib=static=nghttp3");

    // Compression
    println!("cargo:rustc-link-lib=static=brotlidec");
    println!("cargo:rustc-link-lib=static=brotlicommon");
    println!("cargo:rustc-link-lib=static=z");
    println!("cargo:rustc-link-lib=static=zstd");

    // System libraries (platform-dependent)
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    match target_os.as_str() {
        "macos" => {
            println!("cargo:rustc-link-lib=framework=Security");
            println!("cargo:rustc-link-lib=framework=SystemConfiguration");
            println!("cargo:rustc-link-lib=framework=CoreFoundation");
            // AppleIDN requires ICU and iconv
            println!("cargo:rustc-link-lib=icucore");
            println!("cargo:rustc-link-lib=iconv");
            println!("cargo:rustc-link-lib=c++");
        }
        "linux" => {
            println!("cargo:rustc-link-lib=stdc++");
            println!("cargo:rustc-link-lib=pthread");
            println!("cargo:rustc-link-lib=dl");
            println!("cargo:rustc-link-lib=m");
        }
        "windows" => {
            println!("cargo:rustc-link-lib=ws2_32");
            println!("cargo:rustc-link-lib=crypt32");
            println!("cargo:rustc-link-lib=advapi32");
            println!("cargo:rustc-link-lib=bcrypt");
        }
        _ => {}
    }
}

fn target_triple() -> String {
    env::var("TARGET").unwrap_or_else(|_| {
        format!("{}-{}", env::consts::ARCH, env::consts::OS)
    })
}

fn num_cpus() -> usize {
    std::thread::available_parallelism()
        .map(|p| p.get())
        .unwrap_or(4)
}

/// Find a GNU Make 4.0+ binary.
fn find_make() -> String {
    // Try gmake first (Homebrew on macOS)
    for cmd in &["gmake", "/opt/homebrew/bin/gmake", "/usr/local/bin/gmake"] {
        if let Ok(output) = Command::new(cmd).arg("--version").output() {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout);
                if let Some(line) = version.lines().next() {
                    println!("cargo:warning=Using: {} ({})", cmd, line);
                }
                return cmd.to_string();
            }
        }
    }

    // Try system make if version >= 4.0
    if let Ok(output) = Command::new("make").arg("--version").output() {
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout);
            if let Some(line) = version.lines().next() {
                if let Some(ver_str) = line.split_whitespace().last() {
                    if let Some(major) = ver_str.split('.').next() {
                        if major.parse::<u32>().unwrap_or(0) >= 4 {
                            return "make".to_string();
                        }
                    }
                }
            }
        }
    }

    panic!(
        "GNU Make 4.0+ not found. curl-impersonate requires .ONESHELL.\n\
         Install: brew install make"
    );
}
