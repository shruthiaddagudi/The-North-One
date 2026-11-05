/**
 * THE NORTH ONE — Backend Server
 * Powered by Google Gemini API (Free Tier) & Local FAQ Fallback Engine
 * 
 * Features:
 * - Google Gemini API integration via official @google/genai SDK
 * - Strict pricing guardrails (bypasses AI, enforces WhatsApp redirection)
 * - Intelligent local North One FAQ Knowledge Base fallback (offline & rate-limit safe)
 * - Dynamic GEMINI_API_KEY loading from .env
 * - In-memory rate limiting and request validation
 * - Structured logging with timestamped request tracing
 * - Zero client-side API key exposure
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// ── Load Official Google Gen AI SDK ──────────────────────────────────────────
let GoogleGenAI = null;
try {
  const sdk = require('@google/genai');
  GoogleGenAI = sdk.GoogleGenAI;
} catch (err) {
  console.warn(`[SERVER WARNING] Could not load @google/genai: ${err.message}`);
}

// ── Load Local Knowledge Base & FAQ Engine ───────────────────────────────────
const { NORTH_ONE_KNOWLEDGE, queryKnowledgeBase } = require('./data/knowledgeBase');

// ── Structured Logging Helper ────────────────────────────────────────────────
function log(level, message, meta = null) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  if (meta) {
    console.log(`${prefix} ${message}`, meta);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

// ── Dynamic Environment Variables Loader ─────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env[key] = val;
        }
      }
    } catch (e) {
      log('warn', `Failed to read .env file: ${e.message}`);
    }
  }
}

loadEnv();

function getGeminiApiKey() {
  loadEnv();
  return (process.env.GEMINI_API_KEY || '').trim();
}

function getGeminiModel() {
  loadEnv();
  return (process.env.GEMINI_MODEL || 'gemini-3.5-flash').trim();
}

function getPort() {
  return parseInt(process.env.PORT || '3000', 10);
}

// ── Rate Limiter ─────────────────────────────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 35;     // 35 requests per minute per IP

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (valid.length >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  valid.push(now);
  rateLimitMap.set(ip, valid);
  return false;
}

// ── System Instructions for Gemini ───────────────────────────────────────────
const NORTH_ONE_SYSTEM_INSTRUCTIONS = `
You are the AI assistant for THE NORTH ONE.

Answer as a helpful North One agency representative.

Use the conversation history to understand the user's context.

If the user provides their name, business name, industry, goals, or requirements, remember and use that information in later responses during the current conversation.

Do not invent North One services, policies, prices, clients, results, or company information.

North One's services are:
- Brand Identity
- Digital & Web
- Print & Merch
- Marketing & Social

Brand Details:
- Agency Name: THE NORTH ONE
- Tagline: "Every Brand Needs a True North."
- Brand Philosophy: "For as long as ships have sailed, one star has meant the same thing: you are not lost." Before designing a logo or writing a caption, The North One fixes a true north point every part of a brand can design toward — a strategy, a voice, a visual system.

The Four Service Bearings:
1. Brand Identity (Bearing N): Logo design and strategic logo redesigns, comprehensive brand systems, visual identity guidelines, typography systems, color palettes, and brand guidelines that hold up seamlessly from a business card to a billboard.
2. Digital & Web (Bearing E): Websites engineered to load fast and convert. Covers single-page menus, landing pages, digital portfolio showcases, and full-featured e-commerce experiences.
3. Print & Merch (Bearing W): Tangible brand experiences: restaurant/cafe menus, custom packaging, product labels, event merchandise, apparel, brochures, in-store signage, and environmental graphics.
4. Marketing & Social (Bearing S): Social media visual design, content calendars, campaign strategy, feed aesthetics, and brand marketing that keeps the brand's voice and feed consistently on-brand.

Four Steps to True North:
1. Chart (Discovery): We audit your brand, your market landscape, and where you actually want to go.
2. Plot (Strategy): We fix the direction — positioning, voice, and the visual identity to carry it.
3. Sail (Design & Build): Logos, sites, campaigns, merch — designed, built, and refined collaboratively with you.
4. Arrive (Launch & Grow): We ship it, measure real-world performance, and continuously adjust course as the brand grows.

Rules of Engagement:
- Give concise, useful answers.
- When recommending a service, explain WHY it is relevant to the user's specific situation.
- Do not provide prices. Pricing is handled separately by the application.
- Do not automatically tell users to contact the team unless:
  * they explicitly ask how to contact North One,
  * they ask for pricing/quotation,
  * or you genuinely cannot answer their question.
- Never collect personal details or payment credentials.
`.trim();

const EXACT_PRICING_RESPONSE = `Thanks for your interest in North One! Our pricing depends on your project requirements and scope. For accurate pricing and a customised quotation, please contact our team member on WhatsApp.`;

// ── Explicit Contact Request Detector ───────────────────────────────────────
function isExplicitContactQuery(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase().trim();

  const contactPatterns = [
    /\bhow\s+(can|do|to)\s+(i|we)?\s*(contact|reach|talk\s+to|call)\b/i,
    /\b(contact|reach|talk\s+to)\s+(you|team|your\s+team|north\s+one|founder)\b/i,
    /\b(whatsapp|phone|mobile)\s*number\b/i,
    /\bwhat('s|\s+is)\s+your\s+(whatsapp|phone|email|contact)\b/i,
    /\bi\s+want\s+to\s+(talk|speak)\s+to\s+(someone|a\s+human|your\s+team|a\s+person)\b/i,
    /\b(give|share)\s+(me\s+)?(your\s+)?(contact|number|whatsapp|email)\b/i,
    /\bcan\s+i\s+(call|phone)\s+(you|the\s+team)\b/i
  ];

  return contactPatterns.some(pattern => pattern.test(lower));
}

// ── Pricing Intent & Budget Constraint Detector (Deterministic Guardrail) ──
// Strictly checks only the active user message for pricing, cost, or budget intent.
function isPricingQuery(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase().trim();

  // 1. Explicit pricing keywords & negotiation terms
  const pricingKeywords = [
    /\b(price|prices|pricing|priced)\b/,
    /\b(cost|costs|costing)\b/,
    /\b(quote|quotes|quotation|quotations|quoting)\b/,
    /\b(rate|rates|hourly rate|daily rate)\b/,
    /\b(fee|fees)\b/,
    /\b(charge|charges|charging)\b/,
    /\b(how much)\b/,
    /\b(budget|budgets|budgetary|ballpark)\b/,
    /\b(estimate|estimates|estimating|estimation)\b/,
    /\b(package|packages)\s+(price|cost|rate)/,
    /\b(starting\s+(at|price|rate)|starts\s+at|base\s+(price|rate))\b/,
    /\b(discount|discounts|discounted|deal|deals)\b/,
    /\b(cheap|cheaper|cheapest|affordable|affordability|expensive)\b/,
    /\b(lowest|minimum)\s+(price|cost|rate|charge|quote)\b/
  ];

  if (pricingKeywords.some(pattern => pattern.test(lower))) {
    return true;
  }

  // 2. Currency symbols and explicit currency markers (₹, $, €, £, ¥, rupees, rupee, inr, rs, rs.)
  const currencyPatterns = [
    /[₹$€£¥]/,
    /\b(rupee|rupees)\b/,
    /\b(inr|usd|eur|gbp)\b/,
    /\brs\.?\s*\d+/i,                // Rs 1000, Rs. 1000, Rs1000
    /\d+\s*rs\.?\b/i                 // 1000 Rs, 1000Rs
  ];

  if (currencyPatterns.some(pattern => pattern.test(lower))) {
    return true;
  }

  // 3. Thousand multipliers (k/K) attached to numbers: e.g. 1k, 5k, 10k, 20k, 20K
  if (/\b\d+\s*k\b/i.test(lower)) {
    return true;
  }

  // 4. Indian number magnitudes (lakh/lac/crore)
  if (/\b\d+\s*(lakh|lakhs|lac|lacs|crore|crores)\b/i.test(lower)) {
    return true;
  }

  // Units that represent time, quantity, or project assets (NOT money)
  const nonMoneyUnits = '(days?|weeks?|months?|years?|hours?|mins?|minutes?|secs?|seconds?|people|persons?|items?|products?|concepts?|options?|pages?|revisions?|steps?|screens?|variants?|clients?)';

  // 5. Budget constraints: under/within/below/upto/up to/max <amount>
  // e.g., "under 5000", "within 10k", "upto 10000"
  const constraintPattern = new RegExp(`\\b(under|within|below|upto|up\\s+to|max|maximum)\\s*(₹|rs\\.?|\\$)?\\s*(\\d+)(?!\\s*${nonMoneyUnits})`, 'i');
  const constraintMatch = lower.match(constraintPattern);
  if (constraintMatch) {
    const num = parseInt(constraintMatch[3], 10);
    if (constraintMatch[2] || num >= 100) {
      return true;
    }
  }

  // 6. "for <amount>" or "can you do/make/build it for <amount>"
  // e.g., "can you do it for 5000?", "only reels for 3000", "for 1000"
  const forAmountPattern = new RegExp(`\\b(for)\\s*(₹|rs\\.?|\\$)?\\s*(\\d+)(?!\\s*${nonMoneyUnits})\\b`, 'i');
  const forMatch = lower.match(forAmountPattern);
  if (forMatch) {
    const num = parseInt(forMatch[3], 10);
    if (forMatch[2] || num >= 100) {
      return true;
    }
  }

  // 7. "in <amount>" e.g. "in 1000" when not followed by days/weeks/time units
  const inAmountPattern = new RegExp(`\\bin\\s+(₹|rs\\.?|\\$)?\\s*(\\d+)(?!\\s*${nonMoneyUnits})\\b`, 'i');
  const inMatch = lower.match(inAmountPattern);
  if (inMatch) {
    const num = parseInt(inMatch[2], 10);
    // Ignore typical calendar years (1950 - 2035)
    if (num < 1950 || num > 2035) {
      if (inMatch[1] || num >= 100) {
        return true;
      }
    }
  }

  return false;
}

// ── MIME Types Map ───────────────────────────────────────────────────────────
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

// ── Static File Server Helper ────────────────────────────────────────────────
function serveStaticFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
      }
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

// ── Sleep Helper ─────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Gemini Error Classification & Diagnostics ────────────────────────────────
function classifyGeminiError(err) {
  const msg = (err && err.message) ? String(err.message) : String(err || '');
  const status = (err && (err.status || err.code)) || null;

  // 1. 503 Service Unavailable / High Demand
  if (status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('spikes in demand') || msg.toLowerCase().includes('temporarily unavailable')) {
    return { type: '503', retryable: true, status: 503, message: msg };
  }

  // 2. 429 Quota / Rate limit
  if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit')) {
    return { type: '429', retryable: false, status: 429, message: msg };
  }

  // 3. 401/403 Authentication / API Key issues
  if (status === 401 || status === 403 || msg.includes('401') || msg.includes('403') || msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('UNAUTHENTICATED') || msg.includes('GEMINI_API_KEY_MISSING')) {
    return { type: 'AUTH', retryable: false, status: status || 401, message: msg };
  }

  // 4. 404 Model not found or deprecated
  if (status === 404 || msg.includes('404') || msg.includes('NOT_FOUND') || msg.toLowerCase().includes('no longer available') || msg.toLowerCase().includes('not supported') || msg.toLowerCase().includes('model not found')) {
    return { type: 'MODEL_NOT_FOUND', retryable: false, status: 404, message: msg };
  }

  // 5. Request Timeout
  if (msg.includes('TIMEOUT') || msg.toLowerCase().includes('timed out')) {
    return { type: '503', retryable: true, status: 503, message: msg };
  }

  // 6. Network failure / DNS
  if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
    return { type: 'NETWORK', retryable: false, status: 500, message: msg };
  }

  return { type: 'UNKNOWN', retryable: false, status: 500, message: msg };
}

// ── Build Gemini Multi-Turn Contents with Strict Alternation ────────────────
function buildGeminiContents(userMessage, conversationHistory = []) {
  const contents = [];

  if (Array.isArray(conversationHistory)) {
    const recent = conversationHistory.slice(-10);
    for (const msg of recent) {
      if (!msg || typeof msg.content !== 'string' || !msg.content.trim()) continue;
      const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
      // Ensure strict alternation of roles for Gemini SDK
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        continue;
      }
      contents.push({
        role: role,
        parts: [{ text: msg.content.trim() }]
      });
    }
  }

  // Ensure conversation ends with the current user message
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    if (contents[contents.length - 1].parts[0].text !== userMessage.trim()) {
      contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
      contents.push({ role: 'user', parts: [{ text: userMessage.trim() }] });
    }
  } else {
    contents.push({ role: 'user', parts: [{ text: userMessage.trim() }] });
  }

  return contents;
}

// ── Call Single Attempt on Given Model with Upstream Timeout ─────────────────
async function callGeminiSingleAttempt(contents, modelName, timeoutMs = 15000) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY_MISSING');
    err.status = 401;
    throw err;
  }

  if (!GoogleGenAI) {
    const err = new Error('GEMINI_SDK_NOT_AVAILABLE');
    err.status = 500;
    throw err;
  }

  const ai = new GoogleGenAI({ apiKey });

  const apiPromise = ai.models.generateContent({
    model: modelName,
    contents: contents,
    config: {
      systemInstruction: NORTH_ONE_SYSTEM_INSTRUCTIONS
    }
  });

  let timerId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      const timeoutErr = new Error(`GEMINI_TIMEOUT: Request to ${modelName} timed out after ${timeoutMs}ms`);
      timeoutErr.status = 503;
      reject(timeoutErr);
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([apiPromise, timeoutPromise]);
    if (timerId) clearTimeout(timerId);

    const replyText = response && response.text ? response.text.trim() : null;
    if (!replyText) {
      const emptyErr = new Error('GEMINI_EMPTY_RESPONSE');
      emptyErr.status = 500;
      throw emptyErr;
    }
    return replyText;
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}

// ── Candidate Model Pool for Resilient Free Tier Operation ──────────────────
function getCandidateModels() {
  const configured = getGeminiModel();
  const pool = [configured, 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  return Array.from(new Set(pool.filter(Boolean)));
}

// ── Call Gemini with Multi-Turn History, 503 Retries, and Model Cascade ──────
async function callGeminiWithRetry(userMessage, conversationHistory = []) {
  const contents = buildGeminiContents(userMessage, conversationHistory);
  const candidateModels = getCandidateModels();
  const MAX_503_RETRIES = 2;
  const BACKOFF_DELAYS = [1000, 2000];

  log('info', `[AI PIPELINE] Calling Gemini API (Model: ${candidateModels[0]}, Turns: ${contents.length})`);

  let lastError = null;

  for (const model of candidateModels) {
    for (let attempt = 0; attempt <= MAX_503_RETRIES; attempt++) {
      const startTime = Date.now();
      try {
        if (attempt > 0) {
          log('info', `[GEMINI 503] Retrying attempt ${attempt}/${MAX_503_RETRIES} on model "${model}"...`);
        }

        const replyText = await callGeminiSingleAttempt(contents, model, 15000);
        const duration = Date.now() - startTime;
        log('info', `[AI PIPELINE] Gemini response received via "${model}" in ${duration}ms (${replyText.length} chars)`);
        return replyText;
      } catch (err) {
        lastError = err;
        const errorInfo = classifyGeminiError(err);

        // If 503, retry on the same model with backoff
        if (errorInfo.type === '503' && attempt < MAX_503_RETRIES) {
          const backoff = BACKOFF_DELAYS[attempt] || 2000;
          log('warn', `[GEMINI 503] Model "${model}" temporarily busy. Retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_503_RETRIES})...`);
          await sleep(backoff);
          continue;
        }

        // If 429 quota or 404 on this model, try next candidate model in the pool!
        if (errorInfo.type === '429') {
          log('warn', `[GEMINI 429] Model "${model}" quota reached. Attempting next candidate model...`);
          break;
        }
        if (errorInfo.type === 'MODEL_NOT_FOUND') {
          log('warn', `[GEMINI 404] Model "${model}" not found or retired. Attempting next candidate model...`);
          break;
        }

        // For authentication errors, do not retry other models
        if (errorInfo.type === 'AUTH') {
          throw err;
        }

        break;
      }
    }
  }

  throw lastError || new Error('GEMINI_ALL_MODELS_FAILED');
}

// ── HTTP Request Handler ─────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS Headers for secure local & network access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const clientIp = req.socket.remoteAddress || 'unknown';

  // ── Health Check Endpoint ──
  if (pathname === '/api/health' && req.method === 'GET') {
    const apiKey = getGeminiApiKey();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'online',
      provider: 'Google Gemini',
      model: getGeminiModel(),
      geminiKeyConfigured: Boolean(apiKey && apiKey.length > 5),
      faqEngineAvailable: true,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // ── AI Chat Endpoint ──
  if (pathname === '/api/chat' && req.method === 'POST') {
    // Rate Limiting
    if (isRateLimited(clientIp)) {
      log('warn', `Rate limit exceeded for IP: ${clientIp}`);
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: false,
        error: 'Too many requests. Please wait a moment before sending another message.',
        reply: 'You are sending messages quickly. Please pause for a moment, or reach out to our team directly on WhatsApp.',
        showWhatsAppCard: true
      }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const userMessage = (payload.message || '').trim();
        const conversationHistory = Array.isArray(payload.history) ? payload.history : [];
        const apiKey = getGeminiApiKey();

        log('info', `Chat message from ${clientIp}: "${userMessage.slice(0, 65)}${userMessage.length > 65 ? '...' : ''}"`);

        // Input Validation
        if (!userMessage) {
          log('warn', 'Chat request missing message payload.');
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: false,
            error: 'Message is required.'
          }));
          return;
        }

        if (userMessage.length > 1000) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: false,
            error: 'Message exceeds 1000 characters maximum length.'
          }));
          return;
        }

        // 1. STRICT PRICING RESTRICTION (Bypasses AI completely)
        if (isPricingQuery(userMessage)) {
          log('info', '[ROUTING] Decision: Pricing/Budget inquiry detected (bypassing AI).');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            reply: EXACT_PRICING_RESPONSE,
            showContactCTA: true,
            showWhatsAppCard: true,
            source: 'pricing_policy_bypass'
          }));
          return;
        }

        // 2. EXPLICIT CONTACT REQUEST (Bypasses AI completely)
        if (isExplicitContactQuery(userMessage)) {
          log('info', '[ROUTING] Decision: Explicit contact inquiry detected.');
          const contactReply = "You can reach THE NORTH ONE team directly through:\n\n• **WhatsApp & Phone**: [+91 90000 99356](https://wa.me/919000099356?text=Hi%20The%20North%20One%2C%20I%20would%20like%20to%20discuss%20a%20project.)\n• **Email**: northone07@gmail.com\n• **Instagram**: @northoneagency\n• **LinkedIn**: THE NORTH ONE\n\nOur team is happy to discuss your vision.";
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            reply: contactReply,
            showContactCTA: true,
            showWhatsAppCard: true,
            source: 'explicit_contact'
          }));
          return;
        }

        // 3. CONVERSATIONAL QUERY: Route to Google Gemini with conversation history
        log('info', `[ROUTING] Decision: Ordinary query -> Sending to Gemini AI (History turns: ${conversationHistory.length}).`);
        let aiReply = null;
        let responseSource = 'gemini';
        let showContactCTA = false;

        if (apiKey && apiKey.length > 5) {
          try {
            aiReply = await callGeminiWithRetry(userMessage, conversationHistory);
            responseSource = 'gemini';
            // Normal Gemini response: do NOT show contact CTA unless it explicitly says it cannot answer
            const lowerReply = (aiReply || '').toLowerCase();
            if (lowerReply.includes('not able to provide a reliable answer') || lowerReply.includes('cannot provide a reliable answer')) {
              showContactCTA = true;
            } else {
              showContactCTA = false;
            }
          } catch (geminiError) {
            log('warn', `[AI PIPELINE] Gemini API failed: ${geminiError.message}. Activating local FAQ fallback.`);
            // 4. If Gemini fails: Use local FAQ fallback
            const fallbackResult = queryKnowledgeBase(userMessage);
            aiReply = fallbackResult.answer;
            responseSource = fallbackResult.matched ? 'faq_fallback' : 'faq_unanswered';
            // 5. If FAQ also cannot answer: show small Contact our team CTA
            showContactCTA = Boolean(fallbackResult.showContactCTA);
          }
        } else {
          log('info', '[ROUTING] Decision: GEMINI_API_KEY is not configured in .env. Serving from local FAQ engine.');
          const fallbackResult = queryKnowledgeBase(userMessage);
          aiReply = fallbackResult.answer;
          responseSource = fallbackResult.matched ? 'faq_local' : 'faq_unanswered';
          showContactCTA = Boolean(fallbackResult.showContactCTA);
        }


        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          reply: aiReply,
          showContactCTA: showContactCTA,
          showWhatsAppCard: showContactCTA,
          source: responseSource
        }));
      } catch (err) {
        log('error', `Chat processing error: ${err.message}`);
        // Graceful error fallback to knowledge base — Never show technical stack traces to users
        const fallbackResult = queryKnowledgeBase('');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          reply: fallbackResult.answer,
          showContactCTA: true,
          showWhatsAppCard: true,
          source: 'error_fallback'
        }));
      }
    });
    return;
  }

  // ── Static Website Files ──
  if (req.method === 'GET') {
    let safePath = pathname === '/' ? '/index.html' : pathname;
    const normalized = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(__dirname, normalized);

    if (!fullPath.startsWith(__dirname)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
      return;
    }

    fs.stat(fullPath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }
      serveStaticFile(req, res, fullPath);
    });
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('405 Method Not Allowed');
});

// ── Start Server ─────────────────────────────────────────────────────────────
const port = getPort();
server.listen(port, () => {
  const key = getGeminiApiKey();
  console.log(`====================================================`);
  console.log(` THE NORTH ONE — Agency Server & Gemini AI Gateway `);
  console.log(` Website URL:        http://localhost:${port}`);
  console.log(` Health Check:       http://localhost:${port}/api/health`);
  console.log(` Chat Endpoint:      http://localhost:${port}/api/chat`);
  console.log(` AI Provider:        Google Gemini (Free Tier)`);
  console.log(` Gemini Model:       ${getGeminiModel()}`);
  console.log(` Gemini Key Status:  ${key ? `CONFIGURED (${key.slice(0, 6)}...${key.slice(-4)})` : 'NOT SET (Local FAQ Active)'}`);
  console.log(` FAQ Fallback Engine: ACTIVE`);
  console.log(`====================================================`);
});
