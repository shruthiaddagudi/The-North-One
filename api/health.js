/**
 * THE NORTH ONE — Vercel Serverless Function for /api/health
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead ? res.writeHead(204) : (res.status && res.status(204));
    res.end();
    return;
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const responseData = {
    status: 'online',
    provider: 'Google Gemini',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    geminiKeyConfigured: Boolean(apiKey && apiKey.length > 5),
    faqEngineAvailable: true,
    timestamp: new Date().toISOString()
  };

  res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : (res.status && res.status(200));
  res.end(JSON.stringify(responseData));
};

