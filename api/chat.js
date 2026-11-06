/**
 * THE NORTH ONE — Vercel Serverless Function for /api/chat
 * Powered by Google Gemini API (Free Tier) & Local FAQ Fallback Engine
 */

const fs = require('fs');
const path = require('path');

let GoogleGenAI = null;
try {
  const sdk = require('@google/genai');
  GoogleGenAI = sdk.GoogleGenAI;
} catch (err) {
  console.warn(`[API CHAT] Could not load @google/genai: ${err.message}`);
}

const { NORTH_ONE_KNOWLEDGE, queryKnowledgeBase } = require('../data/knowledgeBase');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
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
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch (e) {}
  }
}
loadEnv();

function getGeminiApiKey() {
  loadEnv();
  // 1. Direct standard environment variable
  let key = (process.env.GEMINI_API_KEY || '').trim();

  // 2. Common alternatives
  if (!key) {
    key = (process.env.GOOGLE_API_KEY || process.env.GEMINI_KEY || process.env.GOOGLE_GENAI_API_KEY || '').trim();
  }

  // 3. Fallback: Check if user accidentally pasted API key into GEMINI_MODEL
  const modelVal = (process.env.GEMINI_MODEL || '').trim();
  if (!key && (modelVal.startsWith('AQ.') || modelVal.startsWith('AIza') || modelVal.length > 30)) {
    console.warn('[CONFIG] Detected Gemini API key in GEMINI_MODEL environment variable. Auto-resolving as API key.');
    key = modelVal;
  }

  return key;
}

function getGeminiModel() {
  loadEnv();
  let modelVal = (process.env.GEMINI_MODEL || '').trim();

  // If GEMINI_MODEL was set to an API key, fallback to default model
  if (modelVal.startsWith('AQ.') || modelVal.startsWith('AIza') || modelVal.length > 30) {
    modelVal = '';
  }

  // If GEMINI_API_KEY was accidentally set to a model name (e.g. 'gemini-3.5-flash')
  const keyVal = (process.env.GEMINI_API_KEY || '').trim();
  if (keyVal.startsWith('gemini-') || keyVal.includes('flash')) {
    modelVal = keyVal;
  }

  return modelVal || 'gemini-3.5-flash';
}

const NORTH_ONE_SYSTEM_INSTRUCTIONS = `
You are the AI assistant for THE NORTH ONE, a full-service creative agency and digital growth studio for developing cities.

Your personality:
- Authoritative, refined, modern, articulate, intentional, calm.
- Speak with the quiet confidence of a master navigator.
- Be helpful and warm, but never frivolous, hyperactive, or overly salesy.

IMPORTANT CONVERSATION INSTRUCTIONS:
- You are speaking in an ongoing conversation. Remember details the user told you earlier in this conversation (such as their name, their business name, what they make or sell, their industry, and their goals).
- Always connect your recommendations to the user's specific business and situation. When recommending a North One bearing or service, explain WHY it fits their brand.

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

function isPricingQuery(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase().trim();

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

  const currencyPatterns = [
    /[₹$€£¥]/,
    /\b(rupee|rupees)\b/,
    /\b(inr|usd|eur|gbp)\b/,
    /\brs\.?\s*\d+/i,
    /\d+\s*rs\.?\b/i
  ];

  if (currencyPatterns.some(pattern => pattern.test(lower))) {
    return true;
  }

  if (/\b\d+\s*k\b/i.test(lower)) return true;
  if (/\b\d+\s*(lakh|lakhs|lac|lacs|crore|crores)\b/i.test(lower)) return true;

  const nonMoneyUnits = '(days?|weeks?|months?|years?|hours?|mins?|minutes?|secs?|seconds?|people|persons?|items?|products?|concepts?|options?|pages?|revisions?|steps?|screens?|variants?|clients?)';

  const constraintPattern = new RegExp(`\\b(under|within|below|upto|up\\s+to|max|maximum)\\s*(₹|rs\\.?|\\$)?\\s*(\\d+)(?!\\s*${nonMoneyUnits})`, 'i');
  const constraintMatch = lower.match(constraintPattern);
  if (constraintMatch) {
    const num = parseInt(constraintMatch[3], 10);
    if (constraintMatch[2] || num >= 100) return true;
  }

  const forAmountPattern = new RegExp(`\\b(for)\\s*(₹|rs\\.?|\\$)?\\s*(\\d+)(?!\\s*${nonMoneyUnits})\\b`, 'i');
  const forMatch = lower.match(forAmountPattern);
  if (forMatch) {
    const num = parseInt(forMatch[3], 10);
    if (forMatch[2] || num >= 100) return true;
  }

  const inAmountPattern = new RegExp(`\\bin\\s+(₹|rs\\.?|\\$)?\\s*(\\d+)(?!\\s*${nonMoneyUnits})\\b`, 'i');
  const inMatch = lower.match(inAmountPattern);
  if (inMatch) {
    const num = parseInt(inMatch[2], 10);
    if (num < 1950 || num > 2035) {
      if (inMatch[1] || num >= 100) return true;
    }
  }

  return false;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function classifyGeminiError(err) {
  const msg = (err && err.message) ? String(err.message) : String(err || '');
  const status = (err && (err.status || err.code)) || null;

  if (status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('spikes in demand') || msg.toLowerCase().includes('temporarily unavailable')) {
    return { type: '503', retryable: true, status: 503, message: msg };
  }
  if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit')) {
    return { type: '429', retryable: false, status: 429, message: msg };
  }
  if (status === 401 || status === 403 || msg.includes('401') || msg.includes('403') || msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('UNAUTHENTICATED') || msg.includes('GEMINI_API_KEY_MISSING')) {
    return { type: 'AUTH', retryable: false, status: status || 401, message: msg };
  }
  if (status === 404 || msg.includes('404') || msg.includes('NOT_FOUND') || msg.toLowerCase().includes('no longer available') || msg.toLowerCase().includes('not supported') || msg.toLowerCase().includes('model not found')) {
    return { type: 'MODEL_NOT_FOUND', retryable: false, status: 404, message: msg };
  }
  if (msg.includes('TIMEOUT') || msg.toLowerCase().includes('timed out')) {
    return { type: '503', retryable: true, status: 503, message: msg };
  }
  if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
    return { type: 'NETWORK', retryable: false, status: 500, message: msg };
  }
  return { type: 'UNKNOWN', retryable: false, status: 500, message: msg };
}

function buildGeminiContents(userMessage, conversationHistory = []) {
  const contents = [];
  if (Array.isArray(conversationHistory)) {
    const recent = conversationHistory.slice(-10);
    for (const msg of recent) {
      if (!msg || typeof msg.content !== 'string' || !msg.content.trim()) continue;
      const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
      if (contents.length > 0 && contents[contents.length - 1].role === role) continue;
      contents.push({ role, parts: [{ text: msg.content.trim() }] });
    }
  }
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
    config: { systemInstruction: NORTH_ONE_SYSTEM_INSTRUCTIONS }
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

async function callGeminiWithRetry(userMessage, conversationHistory = []) {
  const contents = buildGeminiContents(userMessage, conversationHistory);
  const configured = getGeminiModel();
  const candidateModels = Array.from(new Set([configured, 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'].filter(Boolean)));
  const MAX_503_RETRIES = 2;
  const BACKOFF_DELAYS = [1000, 2000];

  console.log("Calling Gemini API...");

  let lastError = null;
  for (const model of candidateModels) {
    for (let attempt = 0; attempt <= MAX_503_RETRIES; attempt++) {
      try {
        const replyText = await callGeminiSingleAttempt(contents, model, 15000);
        console.log("Gemini API succeeded");
        return replyText;
      } catch (err) {
        lastError = err;
        const errorInfo = classifyGeminiError(err);
        if (errorInfo.type === '503' && attempt < MAX_503_RETRIES) {
          await sleep(BACKOFF_DELAYS[attempt] || 2000);
          continue;
        }
        if (errorInfo.type === '429' || errorInfo.type === 'MODEL_NOT_FOUND') {
          break;
        }
        if (errorInfo.type === 'AUTH') {
          throw err;
        }
        break;
      }
    }
  }
  throw lastError || new Error('GEMINI_ALL_MODELS_FAILED');
}

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead ? res.writeHead(204) : (res.status && res.status(204));
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : (res.status && res.status(405));
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // Parse Body (pre-parsed by Vercel or streaming buffer)
  let payload = req.body;
  if (!payload || typeof payload !== 'object') {
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e) { payload = {}; }
    } else {
      let bodyData = '';
      await new Promise((resolve) => {
        req.on('data', chunk => bodyData += chunk);
        req.on('end', () => {
          try { payload = JSON.parse(bodyData || '{}'); } catch (e) { payload = {}; }
          resolve();
        });
      });
    }
  }

  const userMessage = ((payload && payload.message) || '').trim();
  const conversationHistory = Array.isArray(payload && payload.history) ? payload.history : [];
  const apiKey = getGeminiApiKey();
  const modelName = getGeminiModel();

  console.log("GEMINI_API_KEY configured:", Boolean(apiKey && apiKey.length > 5));
  console.log("GEMINI_MODEL:", modelName);

  if (!userMessage) {
    res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : (res.status && res.status(400));
    res.end(JSON.stringify({ success: false, error: 'Message is required.' }));
    return;
  }

  // 1. STRICT PRICING RESTRICTION (Bypasses AI completely)
  if (isPricingQuery(userMessage)) {
    res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : (res.status && res.status(200));
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
    const contactReply = "You can reach THE NORTH ONE team directly through:\n\n• **WhatsApp & Phone**: [+91 90000 99356](https://wa.me/919000099356?text=Hi%20The%20North%20One%2C%20I%20would%20like%20to%20discuss%20a%20project.)\n• **Email**: northone07@gmail.com\n• **Instagram**: @northoneagency\n• **LinkedIn**: THE NORTH ONE\n\nOur team is happy to discuss your vision.";
    res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : (res.status && res.status(200));
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
  let aiReply = null;
  let responseSource = 'gemini';
  let showContactCTA = false;

  if (apiKey && apiKey.length > 5) {
    try {
      aiReply = await callGeminiWithRetry(userMessage, conversationHistory);
      responseSource = 'gemini';
      const lowerReply = (aiReply || '').toLowerCase();
      if (lowerReply.includes('not able to provide a reliable answer') || lowerReply.includes('cannot provide a reliable answer')) {
        showContactCTA = true;
      } else {
        showContactCTA = false;
      }
    } catch (geminiError) {
      console.error(`[AI PIPELINE] Gemini call failed: ${geminiError.message}. Using FAQ fallback.`);
      const fallbackResult = queryKnowledgeBase(userMessage);
      aiReply = fallbackResult.answer;
      responseSource = fallbackResult.matched ? 'faq_fallback' : 'faq_unanswered';
      showContactCTA = Boolean(fallbackResult.showContactCTA);
    }
  } else {
    console.error("[SERVER ERROR] GEMINI_API_KEY is missing or invalid. Check Vercel environment variables.");
    const fallbackResult = queryKnowledgeBase(userMessage);
    aiReply = fallbackResult.answer;
    responseSource = fallbackResult.matched ? 'faq_local' : 'faq_unanswered';
    showContactCTA = Boolean(fallbackResult.showContactCTA);
  }

  res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : (res.status && res.status(200));
  res.end(JSON.stringify({
    success: true,
    reply: aiReply,
    showContactCTA: showContactCTA,
    showWhatsAppCard: showContactCTA,
    source: responseSource
  }));
};
