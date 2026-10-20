export function trackingReference(text = '') {
  return text.match(/(?:reference|ref)\s*:\s*(INF-[A-Z0-9-]+)/i)?.[1]?.toUpperCase() || '';
}

export function nicheVoice(niche = '') {
  const key = niche.toLowerCase();
  if (key.includes('fashion')) return 'polished, confident and trend-aware';
  if (key.includes('food') || key.includes('recipe')) return 'warm, welcoming and conversational';
  if (key.includes('travel')) return 'energetic, practical and adventurous';
  if (key.includes('entertainment')) return 'upbeat, clear and personable';
  return 'professional, friendly and concise';
}

export function cleanMessage(text = '') {
  return text.replace(/\0/g, '').trim().slice(0, 4000);
}
