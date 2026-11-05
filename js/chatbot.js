/**
 * THE NORTH ONE — AI Chatbot Controller
 * Integrated with Backend Gateway & OpenAI Responses API
 * 
 * Features:
 * - Scoped UI controls matching website aesthetic
 * - Auto-detecting endpoint with smart fallback (works from file://, live servers, or localhost:3000)
 * - Real AI backend communication via POST /api/chat
 * - Multi-turn conversation history management
 * - Zero client-side API keys
 * - Strict pricing guardrails with direct WhatsApp integration
 * - Safe markdown link formatting and typing indicators
 */

(function () {
  'use strict';

  // Determine optimal API endpoint dynamically
  function resolveApiEndpoint() {
    try {
      const isLocalFile = window.location.protocol === 'file:';
      const isOtherPort = window.location.port && window.location.port !== '3000';
      if (isLocalFile || isOtherPort) {
        return 'http://localhost:3000/api/chat';
      }
    } catch (e) {}
    return '/api/chat';
  }

  // Configuration
  const CHAT_CONFIG = {
    botName: 'The North One AI',
    brandTagline: 'Every Brand Needs a True North.',
    whatsappNumber: '919000099356',
    whatsappDefaultText: 'Hello The North One, I would like to discuss a creative project.',
    apiEndpoint: resolveApiEndpoint(),
    fallbackEndpoint: 'http://localhost:3000/api/chat',
    welcomeMessage: "Hello! Welcome to North One. I'm your AI assistant. How can I help you move your brand forward?",
    suggestedQuestions: [
      "What services do you offer?",
      "Tell me about Brand Identity.",
      "I need a website.",
      "How does your process work?",
      "How can I contact your team?"
    ]
  };

  /**
   * Secure Backend AI Service Bridge
   * Client-side code communicates exclusively through our secure backend proxy
   * to protect LLM API keys and enforce strict rate limits & pricing guardrails.
   */
  class NorthOneAIService {
    constructor(primaryEndpoint, fallbackEndpoint) {
      this.primaryEndpoint = primaryEndpoint;
      this.fallbackEndpoint = fallbackEndpoint;
      this.history = [];
    }

    /**
     * Send message to backend AI service with auto-retry
     */
    async sendMessage(userText) {
      // Send previous conversation turns as context, without duplicating current turn
      const historyPayload = this.history.slice(-10);

      // Record current user turn in session history
      this.history.push({ role: 'user', content: userText });

      const requestPayload = {
        message: userText,
        history: historyPayload
      };

      // Try primary endpoint first
      let result = await this.tryFetch(this.primaryEndpoint, requestPayload);

      // If primary failed with a network error and primary wasn't fallback, try fallback endpoint
      if (!result.connected && this.primaryEndpoint !== this.fallbackEndpoint) {
        console.info(`[The North One AI] Retrying via fallback endpoint ${this.fallbackEndpoint}...`);
        result = await this.tryFetch(this.fallbackEndpoint, requestPayload);
      }

      if (result.connected) {
        this.history.push({ role: 'assistant', content: result.reply });
        return {
          success: result.success,
          reply: result.reply,
          showContactCTA: Boolean(result.showContactCTA !== undefined ? result.showContactCTA : result.showWhatsAppCard)
        };
      }

      // Connection failure friendly message
      const connectionErrorReply = `Unable to reach the North One AI server at http://localhost:3000. Please ensure the backend is running by executing \`npm start\` in your terminal. In the meantime, you can contact our team on WhatsApp.`;
      
      this.history.push({ role: 'assistant', content: connectionErrorReply });

      return {
        success: false,
        reply: connectionErrorReply,
        showContactCTA: true
      };
    }

    async tryFetch(endpoint, payload) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        let data = null;
        try {
          data = await response.json();
        } catch (e) {
          data = null;
        }

        if (response.ok && data && data.success) {
          return {
            connected: true,
            success: true,
            reply: data.reply || "I'm here to help navigate your brand. What would you like to explore?",
            showContactCTA: Boolean(data.showContactCTA !== undefined ? data.showContactCTA : data.showWhatsAppCard)
          };
        } else {
          const fallbackReply = data?.reply || data?.error || `Unable to complete request (${response.status}). Please contact our team on WhatsApp.`;
          return {
            connected: true,
            success: false,
            reply: fallbackReply,
            showContactCTA: true
          };
        }
      } catch (err) {
        console.warn(`[The North One AI] Fetch to ${endpoint} failed: ${err.message}`);
        return {
          connected: false,
          error: err.message
        };
      }
    }
  }

  // DOM Elements & State
  let launcherBtn = null;
  let chatWindow = null;
  let closeBtn = null;
  let messagesContainer = null;
  let chatForm = null;
  let chatInput = null;
  let sendBtn = null;
  let unreadBadge = null;
  let isWindowOpen = false;
  let isAwaitingResponse = false;

  const aiService = new NorthOneAIService(CHAT_CONFIG.apiEndpoint, CHAT_CONFIG.fallbackEndpoint);

  /**
   * Format current time as HH:MM
   */
  function getCurrentTimeString() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Safe HTML Escaping
   */
  function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Format Markdown links, bold, and line breaks safely
   */
  function formatMessageContent(rawText) {
    if (!rawText) return '';

    let safe = escapeHTML(rawText);

    // 1. Format markdown links: [link text](url)
    safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+|mailto:[^\s\)]+|tel:[^\s\)]+)\)/g, (match, text, url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });

    // 2. Format inline code: `code`
    safe = safe.replace(/`([^`]+)`/g, '<code class="tno-inline-code">$1</code>');

    // 3. Format bold text: **text**
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // 4. Format italic text: *text*
    safe = safe.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<em>$2</em>$3');

    // 5. Format unordered list bullets: \n- or \n*
    safe = safe.replace(/\n[\-\*]\s+/g, '<br>• ');

    // 6. Format line breaks
    safe = safe.replace(/\n/g, '<br>');

    return safe;
  }

  /**
   * Scroll messages container to the latest message smoothly
   */
  function scrollToBottom() {
    if (!messagesContainer) return;
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: 'smooth'
    });
  }

  /**
   * Toggle Chat Window Open / Closed
   */
  function toggleChat(forceState) {
    const shouldOpen = typeof forceState === 'boolean' ? forceState : !isWindowOpen;
    isWindowOpen = shouldOpen;

    if (isWindowOpen) {
      chatWindow.classList.add('tno-active');
      document.body.classList.add('tno-chatbot-open');
      launcherBtn.setAttribute('aria-expanded', 'true');
      chatWindow.setAttribute('aria-hidden', 'false');

      if (unreadBadge) {
        unreadBadge.classList.add('tno-hidden');
      }

      if (window.innerWidth > 480) {
        setTimeout(() => chatInput && chatInput.focus(), 250);
      }
      scrollToBottom();
    } else {
      chatWindow.classList.remove('tno-active');
      document.body.classList.remove('tno-chatbot-open');
      launcherBtn.setAttribute('aria-expanded', 'false');
      chatWindow.setAttribute('aria-hidden', 'true');
      launcherBtn.focus();
    }
  }

  /**
   * Append a message bubble to the chat stream
   */
  function appendMessage(sender, text, options = {}) {
    if (!messagesContainer) return;

    const row = document.createElement('div');
    row.className = `tno-msg-row ${sender === 'user' ? 'tno-msg-user' : 'tno-msg-bot'}`;

    const timeString = getCurrentTimeString();

    let avatarHTML = '';
    if (sender === 'bot') {
      avatarHTML = `
        <div class="tno-msg-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 2 L13.5 9.5 L21 11 L13.5 12.5 L12 20 L10.5 12.5 L3 11 L10.5 9.5 Z" fill="var(--gold)"/>
          </svg>
        </div>
      `;
    }

    let extraContentHTML = '';

    // If options include suggested questions (for welcome message)
    if (options.suggestions && options.suggestions.length > 0) {
      const suggestionsHTML = options.suggestions.map(q => `
        <button type="button" class="tno-suggest-btn" data-question="${escapeHTML(q)}">
          <span>${escapeHTML(q)}</span>
          <span class="tno-arrow">→</span>
        </button>
      `).join('');

      extraContentHTML += `
        <div class="tno-suggestions-group">
          <div class="tno-suggestions-label">Explore North One</div>
          ${suggestionsHTML}
        </div>
      `;
    }

    // Compact inline Contact CTA
    if (options.showContactCTA || options.showWhatsAppCard) {
      const waUrl = `https://wa.me/${CHAT_CONFIG.whatsappNumber}?text=${encodeURIComponent(CHAT_CONFIG.whatsappDefaultText)}`;
      extraContentHTML += `
        <div class="tno-contact-cta-wrapper">
          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="tno-contact-cta-btn">
            <svg class="tno-contact-cta-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.174L2 22l4.982-1.408A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.2c-1.614 0-3.12-.472-4.398-1.285l-.315-.2-2.96.837.844-2.884-.207-.327A8.17 8.17 0 013.8 12c0-4.522 3.678-8.2 8.2-8.2s8.2 3.678 8.2 8.2-3.678 8.2-8.2 8.2z"/>
            </svg>
            <span>Contact our team →</span>
          </a>
        </div>
      `;
    }

    const formattedBubbleText = sender === 'bot' ? formatMessageContent(text) : escapeHTML(text);

    row.innerHTML = `
      ${avatarHTML}
      <div class="tno-msg-content">
        <div class="tno-msg-bubble">
          ${formattedBubbleText}
          ${extraContentHTML}
        </div>
        <div class="tno-msg-time">${timeString}</div>
      </div>
    `;

    messagesContainer.appendChild(row);
    scrollToBottom();

    // Bind click events on suggestions
    if (options.suggestions && options.suggestions.length > 0) {
      const buttons = row.querySelectorAll('.tno-suggest-btn');
      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          const questionText = btn.getAttribute('data-question');
          if (questionText && !isAwaitingResponse) {
            handleUserSend(questionText);
          }
        });
      });
    }
  }

  /**
   * Display or remove animated typing indicator
   */
  function setTypingIndicator(show) {
    const existing = document.getElementById('tnoTypingIndicatorRow');

    if (show) {
      if (existing) return;
      const row = document.createElement('div');
      row.className = 'tno-msg-row tno-msg-bot';
      row.id = 'tnoTypingIndicatorRow';
      row.innerHTML = `
        <div class="tno-msg-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 2 L13.5 9.5 L21 11 L13.5 12.5 L12 20 L10.5 12.5 L3 11 L10.5 9.5 Z" fill="var(--gold)"/>
          </svg>
        </div>
        <div class="tno-msg-content">
          <div class="tno-typing-indicator" aria-label="North One AI is typing">
            <span class="tno-typing-dot"></span>
            <span class="tno-typing-dot"></span>
            <span class="tno-typing-dot"></span>
          </div>
        </div>
      `;
      messagesContainer.appendChild(row);
      scrollToBottom();
    } else {
      if (existing) {
        existing.remove();
      }
    }
  }

  /**
   * Handle user submitting a message
   */
  async function handleUserSend(rawText) {
    const text = (rawText || (chatInput ? chatInput.value : '')).trim();
    if (!text || isAwaitingResponse) return;

    if (chatInput) {
      chatInput.value = '';
    }
    if (sendBtn) {
      sendBtn.disabled = true;
    }

    appendMessage('user', text);

    isAwaitingResponse = true;
    setTypingIndicator(true);

    try {
      const result = await aiService.sendMessage(text);
      setTypingIndicator(false);
      appendMessage('bot', result.reply, {
        showContactCTA: Boolean(result.showContactCTA !== undefined ? result.showContactCTA : result.showWhatsAppCard)
      });
    } catch (e) {
      setTypingIndicator(false);
      appendMessage('bot', "We apologize, but an unexpected error occurred. Please contact our team on WhatsApp.", {
        showContactCTA: true
      });
    } finally {
      isAwaitingResponse = false;
      if (chatInput && window.innerWidth > 480) {
        chatInput.focus();
      }
    }
  }

  /**
   * Initialize Chatbot Widget DOM and Events
   */
  function initChatbot() {
    launcherBtn = document.getElementById('tnoChatbotLauncher');
    chatWindow = document.getElementById('tnoChatWindow');
    closeBtn = document.getElementById('tnoChatCloseBtn');
    messagesContainer = document.getElementById('tnoChatMessages');
    chatForm = document.getElementById('tnoChatForm');
    chatInput = document.getElementById('tnoChatInput');
    sendBtn = document.getElementById('tnoChatSendBtn');
    unreadBadge = document.getElementById('tnoLauncherBadge');

    if (!launcherBtn || !chatWindow) {
      console.warn('[The North One] Chatbot DOM elements missing.');
      return;
    }

    launcherBtn.addEventListener('click', () => {
      toggleChat();
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        toggleChat(false);
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isWindowOpen) {
        toggleChat(false);
      }
    });

    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleUserSend();
      });
    }

    if (chatInput && sendBtn) {
      chatInput.addEventListener('input', () => {
        sendBtn.disabled = !chatInput.value.trim() || isAwaitingResponse;
      });
    }

    appendMessage('bot', CHAT_CONFIG.welcomeMessage, {
      suggestions: CHAT_CONFIG.suggestedQuestions
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }
})();
