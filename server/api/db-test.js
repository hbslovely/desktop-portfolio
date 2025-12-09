/**
 * Simple DB test API
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const connectionString = process.env.VIET_STOCK_POOL_POSTGRES_URL 
    || process.env.POSTGRES_URL;

  if (!connectionString) {
    return res.status(500).json({ error: 'No connection string' });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(connectionString);
    
    const result = await sql`SELECT 1 as test`;
    
    return res.status(200).json({ 
      success: true, 
      result: result[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
