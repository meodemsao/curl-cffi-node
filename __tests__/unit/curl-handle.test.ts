/**
 * Story 2.1: Curl Handle & setopt/getinfo Binding
 *
 * Unit tests for the low-level Curl handle API.
 * No network required — tests only option setting and enum exports.
 */

import { describe, it, expect } from 'vitest';
import { Curl, CurlOpt, CurlInfo } from '../helpers/fixtures';

describe('Story 2.1: Curl Handle & setopt/getinfo Binding', () => {
  describe('Curl Constructor', () => {
    it('new Curl() creates a handle without throwing', () => {
      const curl = new Curl();
      expect(curl).toBeDefined();
      expect(typeof curl).toBe('object');
    });

    it('multiple handles can be created', () => {
      const c1 = new Curl();
      const c2 = new Curl();
      expect(c1).toBeDefined();
      expect(c2).toBeDefined();
      expect(c1).not.toBe(c2);
    });
  });

  describe('CurlOpt Enum', () => {
    it('CurlOpt is exported', () => {
      expect(CurlOpt).toBeDefined();
    });

    it('CurlOpt has expected string options', () => {
      expect(CurlOpt.Url).toBeDefined();
      expect(CurlOpt.CustomRequest).toBeDefined();
      expect(CurlOpt.UserAgent).toBeDefined();
      expect(CurlOpt.Proxy).toBeDefined();
    });

    it('CurlOpt has expected long/boolean options', () => {
      expect(CurlOpt.FollowLocation).toBeDefined();
      expect(CurlOpt.MaxRedirs).toBeDefined();
      expect(CurlOpt.TimeoutMs).toBeDefined();
      expect(CurlOpt.SslVerifyPeer).toBeDefined();
      expect(CurlOpt.SslVerifyHost).toBeDefined();
    });

    it('CurlOpt has expected list options', () => {
      expect(CurlOpt.HttpHeader).toBeDefined();
      expect(CurlOpt.ProxyHeader).toBeDefined();
      expect(CurlOpt.Resolve).toBeDefined();
    });
  });

  describe('CurlInfo Enum', () => {
    it('CurlInfo is exported', () => {
      expect(CurlInfo).toBeDefined();
    });

    it('CurlInfo has expected keys', () => {
      expect(CurlInfo.ResponseCode).toBeDefined();
      expect(CurlInfo.TotalTime).toBeDefined();
      expect(CurlInfo.NameLookupTime).toBeDefined();
      expect(CurlInfo.ConnectTime).toBeDefined();
      expect(CurlInfo.AppConnectTime).toBeDefined();
      expect(CurlInfo.EffectiveUrl).toBeDefined();
    });
  });

  describe('setoptStr', () => {
    it('sets URL option', () => {
      const curl = new Curl();
      expect(() => curl.setoptStr(CurlOpt.Url, 'https://httpbin.org/get')).not.toThrow();
    });

    it('sets UserAgent option', () => {
      const curl = new Curl();
      expect(() => curl.setoptStr(CurlOpt.UserAgent, 'TestAgent/1.0')).not.toThrow();
    });

    it('sets Proxy option', () => {
      const curl = new Curl();
      expect(() => curl.setoptStr(CurlOpt.Proxy, 'http://proxy:8080')).not.toThrow();
    });

    it('sets Cookie option', () => {
      const curl = new Curl();
      expect(() => curl.setoptStr(CurlOpt.Cookie, 'name=value')).not.toThrow();
    });

    it('throws for non-string option', () => {
      const curl = new Curl();
      expect(() => curl.setoptStr(CurlOpt.FollowLocation, '1')).toThrow();
    });
  });

  describe('setoptLong', () => {
    it('sets FollowLocation option', () => {
      const curl = new Curl();
      expect(() => curl.setoptLong(CurlOpt.FollowLocation, 1)).not.toThrow();
    });

    it('sets MaxRedirs option', () => {
      const curl = new Curl();
      expect(() => curl.setoptLong(CurlOpt.MaxRedirs, 10)).not.toThrow();
    });

    it('sets TimeoutMs option', () => {
      const curl = new Curl();
      expect(() => curl.setoptLong(CurlOpt.TimeoutMs, 30000)).not.toThrow();
    });

    it('sets SslVerifyPeer option', () => {
      const curl = new Curl();
      expect(() => curl.setoptLong(CurlOpt.SslVerifyPeer, 0)).not.toThrow();
    });

    it('throws for non-long option', () => {
      const curl = new Curl();
      expect(() => curl.setoptLong(CurlOpt.Url, 42)).toThrow();
    });
  });

  describe('setoptList', () => {
    it('sets HttpHeader option', () => {
      const curl = new Curl();
      expect(() =>
        curl.setoptList(CurlOpt.HttpHeader, [
          'Accept: application/json',
          'X-Custom: test',
        ])
      ).not.toThrow();
    });

    it('sets Resolve option', () => {
      const curl = new Curl();
      expect(() =>
        curl.setoptList(CurlOpt.Resolve, ['example.com:443:127.0.0.1'])
      ).not.toThrow();
    });

    it('throws for non-list option', () => {
      const curl = new Curl();
      expect(() => curl.setoptList(CurlOpt.Url, ['test'])).toThrow();
    });
  });

  describe('Handle Lifecycle', () => {
    it('reset() clears options', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, 'https://example.com');
      expect(() => curl.reset()).not.toThrow();
      // After reset, can set new options
      expect(() => curl.setoptStr(CurlOpt.Url, 'https://example.org')).not.toThrow();
    });

    it('duplicate() creates a new handle', () => {
      const curl = new Curl();
      curl.setoptStr(CurlOpt.Url, 'https://example.com');
      const dup = curl.duplicate();
      expect(dup).toBeDefined();
      expect(dup).not.toBe(curl);
    });

    it('strerror() returns error descriptions', () => {
      const curl = new Curl();
      const msg = curl.strerror(28);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    });
  });
});
