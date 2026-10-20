import { generateText, Output } from "ai";
/* Database JSON records are normalized before being exposed outside this module. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { db, config, getRecord, getSettings, id, now } from "./server";
import { trackingReference, nicheVoice } from "./agent-utils.mjs";
import { sendChannelMessage, type InboundMessage } from "./channels";

const decisionSchema = z.object({
  reply: z.string().min(1).max(1200),
  stage: z.enum([
    "greeting",
    "collecting",
    "qualified",
    "package_review",
    "handoff",
    "closed",
  ]),
  intent: z.enum([
    "greeting",
    "collaboration",
    "media_kit",
    "pricing",
    "package",
    "human",
    "other",
  ]),
  handoffRequired: z.boolean(),
  handoffReason: z.string().max(300),
  summary: z.string().max(600),
  contactName: z.string().max(120),
  brandName: z.string().max(160),
  email: z.string().max(200),
  phone: z.string().max(50),
  socialLinks: z.array(z.string().max(500)).max(8),
  requirement: z.string().max(1500),
  budget: z.string().max(120),
  shouldShareMediaKit: z.boolean(),
  packageId: z.string().max(100),
});

type Conversation = {
  id: string;
  channel: string;
  external_thread_id: string;
  external_user_id: string;
  influencer_id: string | null;
  lead_id: string | null;
  contact_name: string | null;
  brand_name: string | null;
  email: string | null;
  phone: string | null;
  social_links: string;
  requirement: string | null;
  budget: string | null;
  summary: string | null;
  status: string;
  stage: string;
  created: string;
  updated: string;
  last_message_at: string;
};
type MessageRow = { role: string; content: string };

function fallback(c: Conversation, influencerName: string) {
  const missing = !c.brand_name
    ? "brand name"
    : !c.requirement
      ? "campaign requirement"
      : !c.email && !c.phone
        ? "email or phone number"
        : !c.social_links || c.social_links === "[]"
          ? "brand social profile link"
          : !c.budget
            ? "estimated budget"
            : "";
  return {
    reply: missing
      ? `Thank you for contacting us regarding ${influencerName}. Please share your ${missing} so I can assist you further.`
      : `Thank you. I have shared your inquiry with our team for review, and they will confirm the most suitable collaboration option.`,
    stage: missing ? "collecting" : "qualified",
    intent: "collaboration",
    handoffRequired: !missing,
    handoffReason: !missing ? "Lead details collected for team review." : "",
    summary: c.summary || "",
    contactName: c.contact_name || "",
    brandName: c.brand_name || "",
    email: c.email || "",
    phone: c.phone || "",
    socialLinks: JSON.parse(c.social_links || "[]"),
    requirement: c.requirement || "",
    budget: c.budget || "",
    shouldShareMediaKit: false,
    packageId: "",
  } as z.infer<typeof decisionSchema>;
}

async function decide(
  c: Conversation,
  history: MessageRow[],
  influencer: any,
  packages: any[],
) {
  const settings = await getSettings();
  if (!config("AI_MODEL") && !config("AI_GATEWAY_API_KEY"))
    return fallback(
      c,
      String(influencer?.data?.name || settings.name || "our creator"),
    );
  const current = {
    contactName: c.contact_name || "",
    brandName: c.brand_name || "",
    email: c.email || "",
    phone: c.phone || "",
    socialLinks: JSON.parse(c.social_links || "[]"),
    requirement: c.requirement || "",
    budget: c.budget || "",
  };
  const result = await generateText({
    model: config("AI_MODEL") || "openai/gpt-5.4-mini",
    output: Output.object({ schema: decisionSchema }),
    system: `You are the PR inquiry assistant for ${settings.name || "Inspirers' Den"}. You represent ${influencer?.data?.name || "the agency"} (${influencer?.data?.niche || "creator"}). Voice: ${nicheVoice(String(influencer?.data?.niche || ""))}. Match the visitor's language; Roman Urdu is allowed. Be natural, concise, and professional: maximum three short sentences and one question at a time. Collect brand name, contact name, email/phone, social link, campaign requirement, timeline and budget. Never invent prices, metrics, availability, discounts or commitments. Only use supplied packages. A package recommendation requires human approval before sending. Set handoffRequired for negotiation, payment, contract/legal topics, complaints, risk, ambiguity, or a request for a human. Media kit may be shared only when a real kit URL is supplied. Preserve already collected fields.`,
    prompt: `Current lead: ${JSON.stringify(current)}\nCreator media kit: ${String(influencer?.data?.kit || "")}\nAvailable packages: ${JSON.stringify(packages.map((p) => ({ id: p.id, name: p.data.name, price: p.data.price, currency: p.data.currency, deliverables: p.data.deliverables })))}\nConversation:\n${history.map((m) => `${m.role}: ${m.content}`).join("\n")}`,
  });
  return result.output;
}

async function resolveInfluencer(message: InboundMessage) {
  const reference = trackingReference(message.text);
  if (reference) return await getRecord(reference);
  if (message.provider === "instagram") {
    const connection = await db()
      .prepare(
        "SELECT influencer_id FROM connections WHERE platform='Instagram' AND external_account_id=? AND status='Connected'",
      )
      .bind(message.recipientId)
      .first<{ influencer_id: string }>();
    if (connection?.influencer_id && connection.influencer_id !== "agency")
      return await getRecord(connection.influencer_id);
  }
  return null;
}

async function upsertLead(
  c: Conversation,
  decision: z.infer<typeof decisionSchema>,
  influencerId: string | null,
) {
  const data = {
    name: decision.brandName || decision.contactName || "New brand inquiry",
    contact: decision.contactName,
    email: decision.email,
    phone: decision.phone,
    social: decision.socialLinks[0] || "",
    requirement: decision.requirement,
    budget: decision.budget,
    currency: "PKR",
    influencerId: influencerId || "",
    source: c.channel === "whatsapp" ? "WhatsApp" : "Instagram",
    platform: c.channel === "whatsapp" ? "WhatsApp" : "Instagram",
    reference: influencerId || "",
    assigned: "",
    status: decision.stage === "qualified" ? "Qualified" : "New",
    notes: "Managed by AI agent",
  };
  if (c.lead_id)
    await db()
      .prepare(
        "UPDATE records SET data=?,updated=?,version=version+1 WHERE id=?",
      )
      .bind(JSON.stringify(data), now(), c.lead_id)
      .run();
  else {
    const leadId = "LEAD-" + id().slice(0, 8).toUpperCase();
    await db()
      .prepare(
        "INSERT INTO records (id,kind,data,created,updated,version) VALUES (?,?,?,?,?,1)",
      )
      .bind(leadId, "lead", JSON.stringify(data), now(), now())
      .run();
    c.lead_id = leadId;
  }
}

export async function processInbound(message: InboundMessage) {
  const duplicate = await db()
    .prepare("SELECT id FROM agent_messages WHERE provider_message_id=?")
    .bind(message.providerMessageId)
    .first();
  if (duplicate) return { duplicate: true };
  const influencer = await resolveInfluencer(message);
  let c = await db()
    .prepare(
      "SELECT * FROM agent_conversations WHERE channel=? AND external_thread_id=?",
    )
    .bind(message.provider, message.threadId)
    .first<Conversation>();
  if (!c) {
    const stamp = now();
    c = {
      id: id(),
      channel: message.provider,
      external_thread_id: message.threadId,
      external_user_id: message.senderId,
      influencer_id: influencer?.id || null,
      lead_id: null,
      contact_name: message.senderName || null,
      brand_name: null,
      email: null,
      phone: null,
      social_links: "[]",
      requirement: null,
      budget: null,
      summary: null,
      status: "active",
      stage: "greeting",
      created: stamp,
      updated: stamp,
      last_message_at: stamp,
    };
    await db()
      .prepare(
        "INSERT INTO agent_conversations (id,channel,external_thread_id,external_user_id,influencer_id,lead_id,contact_name,brand_name,email,phone,social_links,requirement,budget,summary,status,stage,last_message_at,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        c.id,
        c.channel,
        c.external_thread_id,
        c.external_user_id,
        c.influencer_id,
        c.lead_id,
        c.contact_name,
        c.brand_name,
        c.email,
        c.phone,
        c.social_links,
        c.requirement,
        c.budget,
        c.summary,
        c.status,
        c.stage,
        c.last_message_at,
        c.created,
        c.updated,
      )
      .run();
  }
  await db()
    .prepare(
      "INSERT INTO agent_messages (id,conversation_id,provider_message_id,direction,role,content,metadata,status,created) VALUES (?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      id(),
      c.id,
      message.providerMessageId,
      "inbound",
      "user",
      message.text,
      JSON.stringify({ senderName: message.senderName }),
      "received",
      now(),
    )
    .run();
  if (c.status !== "active") return { paused: true, conversationId: c.id };
  const history = (
    await db()
      .prepare(
        "SELECT role,content FROM agent_messages WHERE conversation_id=? ORDER BY created DESC LIMIT 20",
      )
      .bind(c.id)
      .all<MessageRow>()
  ).results.reverse();
  const packageRows = (
    await db()
      .prepare(
        "SELECT * FROM records WHERE kind='package' ORDER BY updated DESC",
      )
      .all<any>()
  ).results
    .map((r: any) => ({ ...r, data: JSON.parse(r.data) }))
    .filter(
      (p: any) =>
        p.data.status !== "Inactive" &&
        (!c!.influencer_id ||
          (p.data.influencerIds || []).length === 0 ||
          (p.data.influencerIds || []).includes(c!.influencer_id)),
    );
  const decision = await decide(c, history, influencer, packageRows);
  c.contact_name = decision.contactName || c.contact_name;
  c.brand_name = decision.brandName || c.brand_name;
  c.email = decision.email || c.email;
  c.phone = decision.phone || c.phone;
  c.social_links = JSON.stringify(
    decision.socialLinks.length
      ? decision.socialLinks
      : JSON.parse(c.social_links || "[]"),
  );
  c.requirement = decision.requirement || c.requirement;
  c.budget = decision.budget || c.budget;
  c.summary = decision.summary || c.summary;
  c.stage = decision.stage;
  c.status = decision.handoffRequired ? "handoff" : "active";
  c.updated = now();
  c.last_message_at = c.updated;
  await upsertLead(c, decision, c.influencer_id);
  await db()
    .prepare(
      "UPDATE agent_conversations SET influencer_id=?,lead_id=?,contact_name=?,brand_name=?,email=?,phone=?,social_links=?,requirement=?,budget=?,summary=?,status=?,stage=?,last_message_at=?,updated=? WHERE id=?",
    )
    .bind(
      c.influencer_id,
      c.lead_id,
      c.contact_name,
      c.brand_name,
      c.email,
      c.phone,
      c.social_links,
      c.requirement,
      c.budget,
      c.summary,
      c.status,
      c.stage,
      c.last_message_at,
      c.updated,
      c.id,
    )
    .run();
  const mediaKit =
    decision.shouldShareMediaKit && influencer?.data?.kit
      ? `\n\nMedia kit: ${String(influencer.data.kit)}`
      : "";
  const reply = decision.reply + mediaKit;
  if (
    decision.packageId &&
    packageRows.some((p) => p.id === decision.packageId)
  )
    await db()
      .prepare(
        "INSERT INTO agent_actions (id,conversation_id,action_type,payload,status,requested) VALUES (?,?,?,?,?,?)",
      )
      .bind(
        id(),
        c.id,
        "send_package",
        JSON.stringify({ packageId: decision.packageId }),
        "pending",
        now(),
      )
      .run();
  const outboundId = id();
  await db()
    .prepare(
      "INSERT INTO agent_messages (id,conversation_id,direction,role,content,metadata,status,created) VALUES (?,?,?,?,?,?,?,?)",
    )
    .bind(
      outboundId,
      c.id,
      "outbound",
      "assistant",
      reply,
      JSON.stringify({
        intent: decision.intent,
        handoffReason: decision.handoffReason,
      }),
      "draft",
      now(),
    )
    .run();
  if (config("AGENT_AUTO_REPLY") === "true") {
    const providerId = await sendChannelMessage(
      c.channel,
      c.external_user_id,
      reply,
    );
    await db()
      .prepare(
        "UPDATE agent_messages SET provider_message_id=?,status='sent' WHERE id=?",
      )
      .bind(providerId || null, outboundId)
      .run();
  }
  return { conversationId: c.id, reply, status: c.status };
}
