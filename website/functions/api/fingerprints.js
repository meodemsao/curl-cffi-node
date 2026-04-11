// Cloudflare Pages Function: /api/fingerprints
// POST - Submit a new fingerprint
// GET  - List recent fingerprints

export async function onRequest(context) {
  const { request, env } = context;

  // CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method === 'POST') {
    return handlePost(request, env, corsHeaders);
  }

  if (request.method === 'GET') {
    return handleGet(request, env, corsHeaders);
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: corsHeaders,
  });
}

async function handlePost(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { fingerprint, metadata } = body;

    if (!fingerprint) {
      return new Response(JSON.stringify({ error: 'Missing fingerprint data' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Extract key fingerprint values
    const ja3Hash = fingerprint.tls?.ja3_hash || null;
    const ja4 = fingerprint.tls?.ja4 || null;
    const akamaiFingerprint = fingerprint.http2?.akamai_fingerprint || null;
    const akamaiFingerprintHash = fingerprint.http2?.akamai_fingerprint_hash || null;
    const httpVersion = fingerprint.http_version || null;
    const userAgent = metadata?.userAgent || fingerprint.user_agent || null;

    // Insert into D1
    const result = await env.DB.prepare(`
      INSERT OR IGNORE INTO fingerprints (
        device_name, browser_name, browser_version, os_name, device_type,
        user_agent, ja3_hash, ja4, akamai_fingerprint, akamai_fingerprint_hash,
        http_version, raw_tls, raw_http2, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      metadata?.deviceName || null,
      metadata?.browserName || null,
      metadata?.browserVersion || null,
      metadata?.osName || null,
      metadata?.deviceType || 'desktop',
      userAgent,
      ja3Hash,
      ja4,
      akamaiFingerprint,
      akamaiFingerprintHash,
      httpVersion,
      JSON.stringify(fingerprint.tls || {}),
      JSON.stringify(fingerprint.http2 || {}),
      request.headers.get('CF-Connecting-IP') || null,
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Fingerprint submitted successfully',
      id: result.meta?.last_row_id,
    }), {
      status: 201,
      headers: corsHeaders,
    });
  } catch (e) {
    // Handle unique constraint (duplicate)
    if (e.message?.includes('UNIQUE constraint')) {
      return new Response(JSON.stringify({
        success: true,
        message: 'This fingerprint already exists in our database',
        duplicate: true,
      }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: e.message || 'Internal error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

async function handleGet(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const results = await env.DB.prepare(`
      SELECT 
        id, device_name, browser_name, browser_version, os_name, device_type,
        ja3_hash, ja4, akamai_fingerprint, http_version, created_at
      FROM fingerprints 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const count = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM fingerprints'
    ).first();

    return new Response(JSON.stringify({
      fingerprints: results.results,
      total: count?.total || 0,
      limit,
      offset,
    }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Internal error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
