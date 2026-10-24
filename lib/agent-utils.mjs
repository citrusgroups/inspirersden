export function trackingReference(text = "") {
  return (
    text
      .match(/(?:reference|ref)\s*:\s*(INF-[A-Z0-9-]+)/i)?.[1]
      ?.toUpperCase() || ""
  );
}

export function nicheVoice(niche = "") {
  const key = niche.toLowerCase();
  if (key.includes("fashion")) return "polished, confident and trend-aware";
  if (key.includes("food") || key.includes("recipe"))
    return "warm, welcoming and conversational";
  if (key.includes("travel")) return "energetic, practical and adventurous";
  if (key.includes("entertainment")) return "upbeat, clear and personable";
  return "professional, friendly and concise";
}

export function cleanMessage(text = "") {
  return text.replace(/\0/g, "").trim().slice(0, 4000);
}

export function basicIntake(text = "") {
  const value = cleanMessage(text);
  const email =
    value.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] || "";
  const phone =
    value
      .match(/(?:\+?\d[\d\s()-]{6,}\d)/)?.[0]
      ?.replace(/\s+/g, " ")
      .trim() || "";
  const socialLinks = [...value.matchAll(/https?:\/\/[^\s<>]+/gi)]
    .map((match) => match[0].replace(/[),.;]+$/, ""))
    .slice(0, 8);
  const brand =
    value
      .match(
        /(?:brand|company|from)\s*(?:is|:|-)?\s*([A-Z0-9][A-Z0-9 &'_-]{1,60}?)(?=\s*(?:,|\.|\||\band\b|\bfor\b|\bwe\b|\bI\b|$))/i,
      )?.[1]
      ?.trim() || "";
  const budget =
    value
      .match(
        /(?:budget|range)\s*(?:is|:|-)?\s*((?:PKR|Rs\.?|USD|AED|SAR|\$)?\s*[\d,.]+(?:\s*[kKmM])?)/i,
      )?.[1]
      ?.trim()
      .replace(/[.,;:]+$/, "") || "";
  const romanUrdu =
    /\b(?:assalam|salam|mujhe|hum|ham|ap|aap|karwana|karni|chahiye|chahta|chahti|kitna|kya)\b/i.test(
      value,
    );
  return { email, phone, socialLinks, brand, budget, romanUrdu };
}
