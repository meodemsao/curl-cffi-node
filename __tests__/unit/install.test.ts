import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const ROOT = join(import.meta.dirname!, '..', '..');

describe('Story 1.4: Install & Distribution Verification', () => {
  describe('Package Configuration', () => {
    it('package.json has correct exports map', () => {
      const pkg = JSON.parse(
        require('fs').readFileSync(join(ROOT, 'package.json'), 'utf8')
      );
      expect(pkg.exports['.']).toBeDefined();
      expect(pkg.exports['.'].import.default).toBe('./dist/index.mjs');
      expect(pkg.exports['.'].require.default).toBe('./dist/index.js');
      expect(pkg.exports['.'].import.types).toBeDefined();
      expect(pkg.exports['.'].require.types).toBeDefined();
    });

    it('package.json has all 6 optionalDependencies', () => {
      const pkg = JSON.parse(
        require('fs').readFileSync(join(ROOT, 'package.json'), 'utf8')
      );
      const deps = Object.keys(pkg.optionalDependencies || {});
      expect(deps).toHaveLength(6);
      expect(deps).toContain('@curl-cffi-node/darwin-arm64');
      expect(deps).toContain('@curl-cffi-node/darwin-x64');
      expect(deps).toContain('@curl-cffi-node/linux-arm64-gnu');
      expect(deps).toContain('@curl-cffi-node/linux-x64-gnu');
      expect(deps).toContain('@curl-cffi-node/linux-x64-musl');
      expect(deps).toContain('@curl-cffi-node/win32-x64-msvc');
    });

    it('package.json engines require Node.js >= 18', () => {
      const pkg = JSON.parse(
        require('fs').readFileSync(join(ROOT, 'package.json'), 'utf8')
      );
      expect(pkg.engines.node).toBe('>=18');
    });
  });

  describe('ESM / CJS Dual Format', () => {
    it('CJS entry point exists (dist/index.js)', () => {
      expect(existsSync(join(ROOT, 'dist', 'index.js'))).toBe(true);
    });

    it('ESM entry point exists (dist/index.mjs)', () => {
      expect(existsSync(join(ROOT, 'dist', 'index.mjs'))).toBe(true);
    });

    it('CJS require works and returns functions', () => {
      const m = require(join(ROOT, 'dist', 'index.js'));
      expect(typeof m.hello).toBe('function');
      expect(typeof m.nativeVersion).toBe('function');
      expect(typeof m.curlVersion).toBe('function');
    });

    it('CJS hello() works', () => {
      const m = require(join(ROOT, 'dist', 'index.js'));
      expect(m.hello()).toContain('curl-cffi-node');
    });

    it('ESM import works via subprocess', () => {
      const result = execSync(
        `node --input-type=module -e "import { hello, curlVersion } from './dist/index.mjs'; console.log(JSON.stringify({ hello: hello(), curl: curlVersion() }));"`,
        { cwd: ROOT, encoding: 'utf8' }
      );
      const data = JSON.parse(result.trim());
      expect(data.hello).toContain('curl-cffi-node');
      expect(data.curl).toContain('IMPERSONATE');
    });
  });

  describe('TypeScript Declarations', () => {
    it('declaration file exists (dist/index.d.ts)', () => {
      expect(existsSync(join(ROOT, 'dist', 'index.d.ts'))).toBe(true);
    });

    it('declaration map exists (dist/index.d.ts.map)', () => {
      expect(existsSync(join(ROOT, 'dist', 'index.d.ts.map'))).toBe(true);
    });

    it('declarations export hello, nativeVersion, curlVersion', () => {
      const dts = require('fs').readFileSync(
        join(ROOT, 'dist', 'index.d.ts'), 'utf8'
      );
      expect(dts).toContain('hello');
      expect(dts).toContain('nativeVersion');
      expect(dts).toContain('curlVersion');
    });
  });

  describe('curl-impersonate Integration', () => {
    it('curlVersion() contains IMPERSONATE', () => {
      const m = require(join(ROOT, 'dist', 'index.js'));
      expect(m.curlVersion()).toContain('IMPERSONATE');
    });

    it('curlVersion() contains BoringSSL', () => {
      const m = require(join(ROOT, 'dist', 'index.js'));
      expect(m.curlVersion()).toContain('BoringSSL');
    });

    it('curlVersion() contains nghttp2', () => {
      const m = require(join(ROOT, 'dist', 'index.js'));
      expect(m.curlVersion()).toContain('nghttp2');
    });

    it('curlVersion() contains brotli', () => {
      const m = require(join(ROOT, 'dist', 'index.js'));
      expect(m.curlVersion()).toContain('brotli');
    });
  });
});
