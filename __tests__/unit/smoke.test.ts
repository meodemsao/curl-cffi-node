import { describe, test, expect } from 'vitest';
import { hello, nativeVersion } from '../../dist/index.js';
import * as path from 'node:path';
import * as fs from 'node:fs';

// Project root is 2 levels up from __tests__/unit/
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

describe('Smoke Tests — Story 1.1: Scaffold Verification', () => {
  // === AC #5: Build produces .node binary ===
  test('native .node binary exists for current platform', () => {
    const nodeFiles = fs.readdirSync(PROJECT_ROOT).filter((f) => f.endsWith('.node'));
    expect(nodeFiles.length).toBeGreaterThan(0);
    expect(nodeFiles[0]).toMatch(/curl-cffi-node\..+\.node/);
  });

  // === AC #6: Minimal #[napi] function is callable from TypeScript ===
  test('hello() returns expected string from native module', () => {
    const result = hello();
    expect(result).toBe('Hello from curl-cffi-node native!');
    expect(typeof result).toBe('string');
  });

  test('nativeVersion() returns semver string', () => {
    const version = nativeVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(version).toBe('0.1.0');
  });

  // === AC #7: lib/index.ts and lib/binding.ts exist ===
  test('lib/index.ts exists', () => {
    expect(fs.existsSync(path.resolve(PROJECT_ROOT, 'lib', 'index.ts'))).toBe(true);
  });

  test('lib/binding.ts exists', () => {
    expect(fs.existsSync(path.resolve(PROJECT_ROOT, 'lib', 'binding.ts'))).toBe(true);
  });

  // === AC #8: ESM and CJS both work ===
  test('CJS require resolves correctly', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../dist/index.js');
    expect(mod.hello).toBeDefined();
    expect(typeof mod.hello).toBe('function');
    expect(mod.hello()).toBe('Hello from curl-cffi-node native!');
  });
});

describe('Project Structure Verification', () => {
  // === AC #1: Root Cargo.toml workspace with native/ member ===
  test('root Cargo.toml exists and is workspace', () => {
    const cargoPath = path.resolve(PROJECT_ROOT, 'Cargo.toml');
    expect(fs.existsSync(cargoPath)).toBe(true);
    const content = fs.readFileSync(cargoPath, 'utf-8');
    expect(content).toContain('[workspace]');
    expect(content).toContain('"native"');
  });

  // === AC #2: native/ crate has cdylib ===
  test('native/Cargo.toml has cdylib lib type', () => {
    const cargoPath = path.resolve(PROJECT_ROOT, 'native', 'Cargo.toml');
    expect(fs.existsSync(cargoPath)).toBe(true);
    const content = fs.readFileSync(cargoPath, 'utf-8');
    expect(content).toContain('cdylib');
    expect(content).toContain('napi');
  });

  test('native/src/lib.rs exists', () => {
    expect(fs.existsSync(path.resolve(PROJECT_ROOT, 'native', 'src', 'lib.rs'))).toBe(true);
  });

  test('native/build.rs exists', () => {
    expect(fs.existsSync(path.resolve(PROJECT_ROOT, 'native', 'build.rs'))).toBe(true);
  });

  // === AC #3: package.json has napi build scripts ===
  test('package.json has build and build:debug scripts', () => {
    const pkgPath = path.resolve(PROJECT_ROOT, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts.build).toBeDefined();
    expect(pkg.scripts['build:debug']).toBeDefined();
    expect(pkg.scripts.build).toContain('napi build');
    expect(pkg.scripts['build:debug']).toContain('napi build');
  });

  // === AC #4: tsconfig.json strict mode ===
  test('tsconfig.json has strict mode enabled', () => {
    const tsconfigPath = path.resolve(PROJECT_ROOT, 'tsconfig.json');
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  // === npm platform packages ===
  test('npm platform packages exist for all 6 targets', () => {
    const platforms = [
      'linux-x64-gnu',
      'linux-x64-musl',
      'linux-arm64-gnu',
      'darwin-x64',
      'darwin-arm64',
      'win32-x64-msvc',
    ];
    for (const platform of platforms) {
      const pkgPath = path.resolve(PROJECT_ROOT, 'npm', platform, 'package.json');
      expect(fs.existsSync(pkgPath)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.name).toBe(`@curl-cffi-node/${platform}`);
    }
  });

  // === dist output ===
  test('dist/ contains compiled JavaScript', () => {
    expect(fs.existsSync(path.resolve(PROJECT_ROOT, 'dist', 'index.js'))).toBe(true);
    expect(fs.existsSync(path.resolve(PROJECT_ROOT, 'dist', 'binding.js'))).toBe(true);
  });

  test('dist/ contains type declarations', () => {
    expect(fs.existsSync(path.resolve(PROJECT_ROOT, 'dist', 'index.d.ts'))).toBe(true);
    expect(fs.existsSync(path.resolve(PROJECT_ROOT, 'dist', 'binding.d.ts'))).toBe(true);
  });
});
