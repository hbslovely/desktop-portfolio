const ALLOWED_METHODS = new Set(['GET', 'POST', 'OPTIONS']);

function appendSearchParams(targetUrl, req) {
  const incoming = new URL(req.url, `https://${req.headers.host}`);
  incoming.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });
}

function parseBody(req) {
  if (req.body == null) return null;
  if (typeof req.body === 'string') return req.body;
  return JSON.stringify(req.body);
}

async function proxyAppsScriptRequest(req, res, envKey) {
  if (!ALLOWED_METHODS.has(req.method)) {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const upstreamRaw = process.env[envKey];
  if (!upstreamRaw) {
    res.status(500).json({
      success: false,
      error: `Missing Vercel env: ${envKey}`,
    });
    return;
  }

  const upstream = new URL(upstreamRaw);
  appendSearchParams(upstream, req);

  const headers = {};
  const contentType = req.headers['content-type'];
  if (contentType) headers['Content-Type'] = contentType;

  const init = {
    method: req.method,
    headers,
    redirect: 'follow',
  };

  if (req.method !== 'GET') {
    const body = parseBody(req);
    if (body != null) {
      init.body = body;
    }
  }

  const response = await fetch(upstream.toString(), init);
  const text = await response.text();

  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      const json = JSON.parse(text);
      res.status(response.status).json(json);
      return;
    } catch {
      // fall through to raw text
    }
  }

  res.status(response.status).send(text);
}

module.exports = { proxyAppsScriptRequest };
