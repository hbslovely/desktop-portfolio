export default async function handler(req) {
  return new Response(JSON.stringify({ success: true, message: 'Minimal test works' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

