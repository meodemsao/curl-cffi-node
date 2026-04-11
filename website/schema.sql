-- Fingerprint submissions table
CREATE TABLE IF NOT EXISTS fingerprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Metadata
  device_name TEXT,
  browser_name TEXT,
  browser_version TEXT,
  os_name TEXT,
  device_type TEXT DEFAULT 'desktop',
  user_agent TEXT,
  
  -- TLS fingerprint hashes
  ja3_hash TEXT,
  ja4 TEXT,
  
  -- HTTP/2 fingerprint
  akamai_fingerprint TEXT,
  akamai_fingerprint_hash TEXT,
  http_version TEXT,
  
  -- Raw data (JSON)
  raw_tls TEXT,
  raw_http2 TEXT,
  
  -- Metadata
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  
  -- Prevent exact duplicates within short time
  UNIQUE(ja3_hash, ja4, user_agent)
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_fingerprints_browser ON fingerprints(browser_name, browser_version);
CREATE INDEX IF NOT EXISTS idx_fingerprints_ja4 ON fingerprints(ja4);
CREATE INDEX IF NOT EXISTS idx_fingerprints_created ON fingerprints(created_at);
