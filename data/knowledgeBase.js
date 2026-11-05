/**
 * THE NORTH ONE — Local Knowledge Base & Offline FAQ Engine
 * 
 * Provides instantaneous, accurate answers about The North One agency.
 * Functions as an intelligent zero-cost fallback when:
 * - Gemini API is rate-limited (429) or unavailable (503)
 * - Network connectivity is offline
 * - User asks common questions without consuming free-tier API quotas
 */

const NORTH_ONE_KNOWLEDGE = {
  agency: {
    name: "THE NORTH ONE",
    tagline: "Every Brand Needs a True North.",
    secondaryMotto: "Let your brand grow rox.",
    philosophy: "For as long as ships have sailed, one star has meant the same thing: you are not lost. Before we design a single logo or write a single caption, we fix a true north point every part of your brand can design toward — a strategy, a voice, a visual system.",
    description: "The North One is a full-service creative studio and digital growth agency for developing cities. We chart identities, campaigns, and digital experiences that give growing brands a clear direction — and the design to back it up.",
    contact: {
      whatsapp: "+91 90000 99356",
      whatsappDigits: "919000099356",
      whatsappUrl: "https://wa.me/919000099356?text=Hello%20The%20North%20One%2C%20I%20would%20like%20to%20discuss%20a%20creative%20project.",
      email: "northone07@gmail.com",
      instagram: "@northoneagency",
      instagramUrl: "https://www.instagram.com/northoneagency/",
      linkedin: "THE NORTH ONE",
      linkedinUrl: "https://www.linkedin.com/company/the-north-one/"
    }
  },

  services: [
    {
      id: "identity",
      bearing: "N",
      name: "Brand Identity",
      summary: "Logo design, comprehensive brand systems, and guidelines that hold up from a business card to a billboard.",
      details: [
        "New logo design and strategic logo redesigns",
        "Visual identity systems, typography hierarchies, and color palettes",
        "Brand style guides and brand governance documentation",
        "Stationery, business cards, letterheads, and brand collateral",
        "Brand voice, tone, and messaging architecture"
      ],
      keywords: ["identity", "brand", "branding", "logo", "redesign", "guidelines", "typography", "palette", "visual identity"]
    },
    {
      id: "digital",
      bearing: "E",
      name: "Digital & Web",
      summary: "High-performance websites built to load fast, reflect your identity, and convert visitors.",
      details: [
        "Custom website design & modern front-end development",
        "High-converting landing pages and single-page interactive menus",
        "Creative portfolio showcases and digital publication platforms",
        "Full e-commerce experiences and online storefronts",
        "Mobile-first responsive design, SEO optimization, and speed tuning"
      ],
      keywords: ["web", "website", "digital", "ecommerce", "e-commerce", "landing page", "store", "online", "ui", "ux", "responsive"]
    },
    {
      id: "print",
      bearing: "W",
      name: "Print & Merch",
      summary: "Tactile brand touchpoints — menus, packaging, event merchandise, and signage that people hold in their hands.",
      details: [
        "Restaurant, bar, and cafe menu design",
        "Bespoke packaging and product label design",
        "Custom event merchandise, apparel, tote bags, and accessories",
        "Print collateral, brochures, lookbooks, and editorial print",
        "In-store signage, wayfinding, and spatial environmental graphics"
      ],
      keywords: ["print", "merch", "merchandise", "packaging", "menus", "menu", "signage", "brochure", "apparel", "labels", "boxes"]
    },
    {
      id: "marketing",
      bearing: "S",
      name: "Marketing & Social",
      summary: "Social media design, content calendars, campaign strategy, and marketing that keeps your feed on-brand.",
      details: [
        "Social media visual identity, templates, and grid curation",
        "Strategic content calendars and editorial planning",
        "Digital campaign creative, advertising assets, and launch marketing",
        "Brand storytelling and organic social growth strategy"
      ],
      keywords: ["marketing", "social", "instagram", "campaign", "social media", "feed", "content", "calendar", "ads", "advertising"]
    }
  ],

  process: [
    {
      step: 1,
      verb: "Chart",
      title: "Discovery",
      description: "We audit your brand, your market landscape, and where you actually want to go."
    },
    {
      step: 2,
      verb: "Plot",
      title: "Strategy",
      description: "We fix the direction — positioning, voice, and the visual identity to carry it."
    },
    {
      step: 3,
      verb: "Sail",
      title: "Design & Build",
      description: "Logos, sites, campaigns, merch — designed, built, and refined collaboratively with you."
    },
    {
      step: 4,
      verb: "Arrive",
      title: "Launch & Grow",
      description: "We ship it, measure real-world performance, and continuously adjust course as your brand grows."
    }
  ],

  portfolio: [
    { name: "AmberlyMade", tag: "Identity · Social · Web", desc: "Handcrafted crochet label. Brand identity, social media design, and website." },
    { name: "Wave (AshaWave)", tag: "Web · Identity", desc: "Virtual library and deep attention community. Digital brand system and platform." },
    { name: "White Dot Design Company", tag: "Interior Design · Web", desc: "Boutique interior design studio. Digital presence and web experience." },
    { name: "Odd Fellows Cafe", tag: "Menus · Signage · Web", desc: "Neighbourhood cafe. Menu design, in-store signage, and website." },
    { name: "Himalayan Granites", tag: "Logo · Collateral · Web", desc: "Stone and surfaces supplier. Logo redesign, collateral, and website." }
  ],

  faqs: [
    {
      patterns: [/services/i, /what do you (do|offer)/i, /what does north one (do|offer)/i, /bearings/i],
      answer: "THE NORTH ONE offers creative services across four primary bearings:\n\n• **Brand Identity**: Logo design, brand systems, typography, and comprehensive guidelines.\n• **Digital & Web**: Fast-loading, high-converting websites, landing pages, and e-commerce.\n• **Print & Merch**: Menus, custom packaging, event merchandise, apparel, and signage.\n• **Marketing & Social**: Social media design, content calendars, and campaign strategy.\n\nWhich area would you like to explore for your brand?"
    },
    {
      patterns: [/brand identity/i, /logo/i, /rebrand/i, /visual identity/i],
      answer: "Our **Brand Identity** service establishes your brand's core foundation:\n\n• Strategic logo design and redesigns\n• Comprehensive brand guidelines & visual systems\n• Typography hierarchy and curated color palettes\n• Stationery, collateral, and business cards\n• Brand voice and tone architecture\n\nEvery identity we build is crafted to stand strong from a business card to a billboard."
    },
    {
      patterns: [/website/i, /web design/i, /digital/i, /ecommerce/i, /e-commerce/i, /landing page/i],
      answer: "Our **Digital & Web** service builds high-performance online experiences:\n\n• Custom website design & modern responsive front-end engineering\n• Fast-loading landing pages and single-page interactive menus\n• Portfolio platforms and editorial digital experiences\n• Complete e-commerce stores optimized for conversions\n• SEO-friendly, mobile-first design\n\nTell us about the website you need, and we can discuss the right structure for you!"
    },
    {
      patterns: [/print/i, /merch/i, /packaging/i, /menu/i, /signage/i],
      answer: "Our **Print & Merch** service crafts tangible experiences you can hold:\n\n• Restaurant and cafe menus that elevate the dining experience\n• Custom product packaging and label design\n• Event merchandise, branded apparel, and tote bags\n• Signage, wayfinding, and spatial brand graphics\n• Print collateral, lookbooks, and brochures."
    },
    {
      patterns: [/marketing/i, /social media/i, /campaign/i, /content/i, /instagram/i],
      answer: "Our **Marketing & Social** bearing ensures your brand stays consistent and engaging:\n\n• Social media visual identity and feed aesthetic curation\n• Strategic content calendars and post planning\n• Campaign design for digital launches and promotions\n• On-brand messaging and organic social assets."
    },
    {
      patterns: [/process/i, /how (do you|does it) work/i, /steps/i, /workflow/i, /methodology/i],
      answer: "We navigate projects through **Four Steps to True North**:\n\n1. **Chart (Discovery)**: We audit your brand, market landscape, and where you want to go.\n2. **Plot (Strategy)**: We fix the direction — positioning, voice, and visual identity.\n3. **Sail (Design & Build)**: Logos, sites, campaigns, and merch — refined with you.\n4. **Arrive (Launch & Grow)**: We ship it, measure it, and keep adjusting course.\n\nWould you like to start a project with us?"
    },
    {
      patterns: [
        /\bhow\s+(can|do|to)\s+(i|we)?\s*(contact|reach|talk\s+to|call)\b/i,
        /\b(contact|reach|talk\s+to)\s+(you|team|your\s+team|north\s+one|founder)\b/i,
        /\b(whatsapp|phone|mobile)\s*(number)?\b/i,
        /\bwhat('s|\s+is)\s+your\s+(whatsapp|phone|email|contact)\b/i,
        /\bi\s+want\s+to\s+(talk|speak)\s+to\s+(someone|a\s+human|your\s+team)\b/i
      ],
      answer: "You can reach THE NORTH ONE team directly through:\n\n• **WhatsApp & Phone**: [+91 90000 99356](https://wa.me/919000099356?text=Hi%20The%20North%20One%2C%20I%20would%20like%20to%20discuss%20a%20project.)\n• **Email**: [northone07@gmail.com](mailto:northone07@gmail.com)\n• **Instagram**: [@northoneagency](https://www.instagram.com/northoneagency/)\n• **LinkedIn**: [THE NORTH ONE](https://www.linkedin.com/company/the-north-one/)\n\nOur team is happy to discuss your vision."
    },
    {
      patterns: [/portfolio/i, /work/i, /clients/i, /projects/i, /case studies/i, /examples/i],
      answer: "Here are a few brands we have recently charted:\n\n• **AmberlyMade**: Brand identity, social media, and web for a handcrafted crochet label.\n• **Wave (AshaWave)**: Digital brand system and platform for a virtual library initiative.\n• **White Dot Design Company**: Digital presence for a boutique interior & spatial design studio.\n• **Odd Fellows Cafe**: Menu design, signage, and website for an independent cafe.\n• **Himalayan Granites**: Logo redesign, collateral, and website for stone suppliers."
    },
    {
      patterns: [/about/i, /who are you/i, /company/i, /agency/i, /location/i, /where are you/i],
      answer: "**THE NORTH ONE** is a full-service creative agency and studio tailored for growing brands in developing cities. Our tagline is *'Every Brand Needs a True North.'* We chart brand identities, digital web experiences, print collateral, and marketing campaigns with clarity and intent."
    }
  ]
};

/**
 * Intelligent Local Knowledge Base Search Engine
 * Matches queries against FAQ patterns, service descriptions, and keywords.
 * Returns null if no relevant match is found.
 */
function queryKnowledgeBase(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') {
    return {
      answer: "I'm not able to provide a reliable answer to that. Please contact our team member for assistance.",
      matched: false,
      source: 'unanswered_fallback',
      showContactCTA: true,
      showWhatsAppCard: true
    };
  }
  const clean = userMessage.trim();

  // 1. Direct Pattern Matching across FAQs
  for (const faq of NORTH_ONE_KNOWLEDGE.faqs) {
    if (faq.patterns.some(pattern => pattern.test(clean))) {
      const isExplicitContact = faq.patterns.some(p => p.test('contact') || p.test('reach') || p.test('touch') || p.test('call'));
      return {
        answer: faq.answer,
        matched: true,
        source: 'faq_match',
        showContactCTA: isExplicitContact,
        showWhatsAppCard: isExplicitContact
      };
    }
  }

  // 2. Keyword & Token Scoring across Service Offerings
  const words = clean.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  let bestService = null;
  let maxScore = 0;

  for (const service of NORTH_ONE_KNOWLEDGE.services) {
    let score = 0;
    for (const w of words) {
      if (service.keywords.includes(w)) score += 3;
      if (service.name.toLowerCase().includes(w)) score += 4;
      if (service.summary.toLowerCase().includes(w)) score += 1;
    }
    if (score > maxScore) {
      maxScore = score;
      bestService = service;
    }
  }

  if (bestService && maxScore >= 3) {
    return {
      answer: `Here is information on our **${bestService.name}** service (Bearing ${bestService.bearing}):\n\n${bestService.summary}\n\nKey capabilities include:\n• ${bestService.details.join('\n• ')}\n\nWould you like to explore a ${bestService.name} project for your brand?`,
      matched: true,
      source: 'service_keyword_match',
      showContactCTA: false,
      showWhatsAppCard: false
    };
  }

  // 3. Fallback when local knowledge base cannot answer reliably
  return {
    answer: "I'm not able to provide a reliable answer to that. Please contact our team member for assistance.",
    matched: false,
    source: 'unanswered_fallback',
    showContactCTA: true,
    showWhatsAppCard: true
  };
}

module.exports = {
  NORTH_ONE_KNOWLEDGE,
  queryKnowledgeBase
};

