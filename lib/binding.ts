/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Platform-specific native binding loader.
 *
 * This module detects the current platform (os + arch + libc) and loads
 * the corresponding prebuilt `.node` binary. If no prebuilt binary is
 * available, it falls back to loading a locally compiled binary.
 */

import type { NativeBinding } from './types.js';

const platformPackages: Record<string, string> = {
  'linux-x64-gnu': '@curl-cffi-node/linux-x64-gnu',
  'linux-x64-musl': '@curl-cffi-node/linux-x64-musl',
  'linux-arm64-gnu': '@curl-cffi-node/linux-arm64-gnu',
  'darwin-x64': '@curl-cffi-node/darwin-x64',
  'darwin-arm64': '@curl-cffi-node/darwin-arm64',
  'win32-x64-msvc': '@curl-cffi-node/win32-x64-msvc',
};

function getPlatformKey(): string {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') {
    return `win32-${arch}-msvc`;
  }

  if (platform === 'linux') {
    // Detect musl vs glibc
    const isMusl = isMuslLibc();
    const libc = isMusl ? 'musl' : 'gnu';
    return `linux-${arch}-${libc}`;
  }

  return `${platform}-${arch}`;
}

function isMuslLibc(): boolean {
  try {
    const { execSync } = require('child_process');
    const output = execSync('ldd --version 2>&1', { encoding: 'utf8' });
    return output.toLowerCase().includes('musl');
  } catch {
    // If ldd fails, check for /lib/ld-musl-*
    try {
      const { readdirSync } = require('fs');
      const files = readdirSync('/lib');
      return files.some((f: string) => f.startsWith('ld-musl'));
    } catch {
      return false;
    }
  }
}

function loadNativeBinding(): NativeBinding {
  const platformKey = getPlatformKey();
  const packageName = platformPackages[platformKey];

  // Try 1: Load from platform-specific npm package
  if (packageName) {
    try {
      return require(packageName) as NativeBinding;
    } catch {
      // Platform package not installed, try local binary
    }
  }

  // Try 2: Load locally compiled binary (development mode)
  try {
    return require(`../curl-cffi-node.${platformKey}.node`) as NativeBinding;
  } catch {
    // Local binary not found
  }

  // Try 3: Load any .node file in root (single-platform dev build)
  try {
    const { readdirSync } = require('fs');
    const { join } = require('path');
    const rootDir = join(__dirname, '..');
    const nodeFiles = readdirSync(rootDir).filter((f: string) => f.endsWith('.node'));
    if (nodeFiles.length > 0) {
      return require(join(rootDir, nodeFiles[0])) as NativeBinding;
    }
  } catch {
    // No .node files found
  }

  throw new Error(
    `Failed to load native binding for platform: ${platformKey}\n` +
    `Tried: ${packageName || 'no platform package'}, local binary\n` +
    `Please ensure the package is installed correctly for your platform.\n` +
    `Supported platforms: ${Object.keys(platformPackages).join(', ')}`
  );
}

export const nativeBinding: NativeBinding = loadNativeBinding();
