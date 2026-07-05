/**
 * Vercel serverless function — proxy chat completion tới HuggingFace Router.
 *
 * Vai trò:
 *  1. Giữ HF_TOKEN ở server (browser không bao giờ cầm token).
 *  2. XÂY SYSTEM PROMPT ở server từ `body.context` (snapshot dữ liệu bé) —
 *     client chỉ gửi { context, messages, model, ... }. Prompt/tool-spec không
 *     bị bundle xuống client JS.
 *  3. Forward tới HF Router (OpenAI chat-completions shape) và pipe response về.
 *
 * Dual-mode:
 *  - Khi Vercel require() → export handler (module.exports).
 *  - Khi `node api/hf-chat.js` → khởi động HTTP server local (dev, port 8081),
 *    load .env.local qua dotenv. `proxy.conf.js` forward /api/hf-chat tới đây.
 *
 * Env (server-side, không expose xuống client):
 *   HF_TOKEN          — access token với quyền "Inference Providers".
 *   HF_INFERENCE_URL  — optional, mặc định https://router.huggingface.co/v1/chat/completions
 *   HF_MODEL_FALLBACK — optional, dùng nếu body client không chứa `model`.
 */

const { buildSystemPrompt } = require('./hf-prompt');

const DEFAULT_HF_URL = 'https://router.huggingface.co/v1/chat/completions';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Chuẩn hoá body client → body gửi lên HF Router.
 * - Nhận { context, messages, model, temperature?, max_tokens? }.
 * - Build system prompt từ context, prepend vào messages.
 * - Strip `context` khỏi body trước khi forward.
 */
function buildUpstreamBody(body, fallbackModel) {
  const out = { ...body };
  const context = out.context;
  delete out.context;

  const messages = Array.isArray(out.messages) ? out.messages : [];
  if (context && typeof context === 'object') {
    const sys = buildSystemPrompt(context);
    out.messages = [{ role: 'system', content: sys }, ...messages];
  } else {
    out.messages = messages;
  }

  if (!out.model && fallbackModel) out.model = fallbackModel;
  return out;
}

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'Missing server env HF_TOKEN' });
    return;
  }

  const upstream = process.env.HF_INFERENCE_URL || DEFAULT_HF_URL;
  const fallbackModel = process.env.HF_MODEL_FALLBACK;

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
  }
  if (!body || typeof body !== 'object') {
    body = {};
  }

  const upstreamBody = buildUpstreamBody(body, fallbackModel);

  try {
    const resp = await fetch(upstream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(upstreamBody),
    });

    const text = await resp.text();
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        res.status(resp.status).json(JSON.parse(text));
        return;
      } catch {
        /* fall through */
      }
    }
    res.status(resp.status).setHeader('Content-Type', ct || 'text/plain').send(text);
  } catch (err) {
    res.status(502).json({ error: `HF proxy failed: ${err?.message || 'unknown'}` });
  }
}

module.exports = handler;

// ── Local dev server (chỉ khi chạy `node api/hf-chat.js`) ─────────────────────
if (require.main === module) {
  const path = require('path');
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  } catch {
    /* dotenv chưa cài — fallback shell env */
  }
  const http = require('http');

  // Polyfill Express-style res (status/json/send) lên native http.ServerResponse
  // để cùng handler chạy được cả local lẫn Vercel (@vercel/node cho res Express-like).
  function polyfillRes(res) {
    if (!res.status) {
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
    }
    if (!res.json) {
      res.json = (obj) => {
        if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(obj));
        return res;
      };
    }
    if (!res.send) {
      res.send = (body) => {
        res.end(body);
        return res;
      };
    }
    return res;
  }

  // Native http KHÔNG parse body (Vercel thì tự parse). Đọc stream → JSON → req.body.
  function readBody(req) {
    return new Promise((resolve) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) {
          resolve(undefined);
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(raw);
        }
      });
      req.on('error', () => resolve(undefined));
    });
  }

  const port = Number(process.env.HF_DEV_PORT) || 8081;
  http
    .createServer(async (req, res) => {
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        req.body = await readBody(req);
      }
      handler(req, polyfillRes(res));
    })
    .listen(port, '127.0.0.1', () => {
      const ok = process.env.HF_TOKEN ? 'OK' : 'THIẾU HF_TOKEN — /api/hf-chat sẽ trả 500';
      console.log(`[hf-chat] dev server http://127.0.0.1:${port}  (token: ${ok})`);
    })
    .on('error', (e) => {
      console.error('[hf-chat] dev server lỗi:', e.message);
      process.exit(1);
    });
}
