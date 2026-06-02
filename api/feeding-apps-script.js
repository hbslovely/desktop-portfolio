const FEEDING_APPS_SCRIPT_EXEC_URL =
  'https://script.google.com/macros/s/AKfycbzeEaz8xMniaEU8f-65tkER8OSCvBn1xGN0hH4GYLRAHVIlT4n6jdLHhPu-IcdCI3C05A/exec';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function normalizeBody(body) {
  if (typeof body === 'string') return body;
  if (!body) return '{}';
  try {
    return JSON.stringify(body);
  } catch (_error) {
    return '{}';
  }
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const method = req.method === 'GET' ? 'GET' : 'POST';
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const targetUrl = `${FEEDING_APPS_SCRIPT_EXEC_URL}${query}`;

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method,
      redirect: 'follow',
      headers:
        method === 'POST'
          ? {
              'Content-Type': 'text/plain;charset=utf-8',
            }
          : undefined,
      body: method === 'POST' ? normalizeBody(req.body) : undefined,
    });

    const rawResponse = await upstreamResponse.text();
    const contentType = upstreamResponse.headers.get('content-type') || '';
    const status = upstreamResponse.ok ? 200 : upstreamResponse.status || 502;

    if (contentType.includes('application/json')) {
      try {
        return res.status(status).json(JSON.parse(rawResponse));
      } catch (_error) {
        return res.status(status).send(rawResponse);
      }
    }

    try {
      return res.status(status).json(JSON.parse(rawResponse));
    } catch (_error) {
      return res.status(status).send(rawResponse);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    return res.status(502).json({
      success: false,
      error: `Feeding Apps Script proxy failed: ${message}`,
    });
  }
};
