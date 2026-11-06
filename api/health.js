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

  // Securely resolve API key and Model name without exposing credentials
  let apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  let modelName = (process.env.GEMINI_MODEL || 'gemini-3.5-flash').trim();

  // If user accidentally put the API key in GEMINI_MODEL, detect it safely
  if (!apiKey && (modelName.startsWith('AQ.') || modelName.startsWith('AIza') || modelName.length > 30)) {
    apiKey = modelName;
    modelName = 'gemini-3.5-flash';
  } else if (modelName.startsWith('AQ.') || modelName.startsWith('AIza') || modelName.length > 30) {
    modelName = 'gemini-3.5-flash';
  }

  const responseData = {
    status: 'online',
    provider: 'Google Gemini',
    model: modelName,
    geminiKeyConfigured: Boolean(apiKey && apiKey.length > 5),
    faqEngineAvailable: true,
    timestamp: new Date().toISOString()
  };

  res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : (res.status && res.status(200));
  res.end(JSON.stringify(responseData));
};

