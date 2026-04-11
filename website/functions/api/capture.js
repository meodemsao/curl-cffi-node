// Cloudflare Pages Function: /api/capture
// Proxies requests to tls.peet.ws to avoid CORS issues.
// Note: This captures the Cloudflare edge's TLS fingerprint,
// NOT the visitor's browser fingerprint.
// For real visitor fingerprint capture, deploy the Go server.

export async function onRequest(context) {
  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const response = await fetch('https://tls.peet.ws/api/all', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': context.request.headers.get('User-Agent') || 'curl-cffi-node/fingerprint',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Upstream returned ${response.status}` }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const data = await response.text();

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Failed to capture' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
