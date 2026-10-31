import { generateText, Output } from "ai";
/* Database JSON records are normalized before being exposed outside this module. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { bucket, db, config, getRecord, getSettings, id, now } from "./server";
import { trackingReference, nicheVoice, basicIntake } from "./agent-utils.mjs";
import {
  channelOptionsFor,
  sendChannelMessage,
  type InboundMessage,
} from "./channels";

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
  campaignType: z.string().max(160),
  productService: z.string().max(300),
  deliverables: z.string().max(600),
  reels: z.number().int().min(0).max(100),
  stories: z.number().int().min(0).max(100),
  posts: z.number().int().min(0).max(100),
  campaignDate: z.string().max(100),
  campaignDuration: z.string().max(160),
  location: z.string().max(200),
  specialRequirements: z.string().max(800),
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
  campaign_type: string | null;
  product_service: string | null;
  deliverables: string | null;
  reels: number;
  stories: number;
  posts: number;
  campaign_date: string | null;
  campaign_duration: string | null;
  location: string | null;
  special_requirements: string | null;
  budget: string | null;
  summary: string | null;
  status: string;
  stage: string;
  created: string;
  updated: string;
  last_message_at: string;
};
type MessageRow = { role: string; content: string };

function fallback(
  c: Conversation,
  influencerName: string,
  niche: string,
  history: MessageRow[],
  packages: any[],
) {
  const latest =
    [...history].reverse().find((message) => message.role === "user")
      ?.content || "";
  const intake = basicIntake(latest);
  const contactName = c.contact_name || "";
  const brandName = c.brand_name || intake.brand;
  const email = c.email || intake.email;
  const phone = c.phone || intake.phone;
  const existingSocial = JSON.parse(c.social_links || "[]") as string[];
  const socialLinks = existingSocial.length
    ? existingSocial
    : intake.socialLinks;
  const requirement = c.requirement || (latest.length >= 12 ? latest : "");
  const campaignType = c.campaign_type || intake.campaignType;
  const deliverables = c.deliverables || intake.deliverables;
  const productService = c.product_service || "";
  const campaignDate = c.campaign_date || "";
  const campaignDuration = c.campaign_duration || "";
  const location = c.location || "";
  const budget = c.budget || intake.budget;
  const missing =
    (
      [
        [!brandName, "brand name"],
        [!requirement, "campaign requirement"],
        [!campaignType, "campaign type"],
        [!productService, "product or service being promoted"],
        [
          !deliverables,
          "required deliverables (reels, stories, posts or event coverage)",
        ],
        [!campaignDate, "campaign date or expected timeline"],
        [!campaignDuration, "campaign duration"],
        [!location, "campaign location"],
        [!email && !phone, "email or phone number"],
        [!socialLinks.length, "brand social profile link"],
        [!budget, "estimated budget"],
      ] as [boolean, string][]
    ).find(([needed]) => needed)?.[1] || "";
  const asksForPackage =
    /\b(?:price|pricing|package|rates?|charges?|cost|kit)\b/i.test(latest);
  const needsHuman =
    /\b(?:human|manager|person|negotiate|negotiation|discount|contract|payment|complaint|issue)\b/i.test(
      latest,
    );
  const packageId =
    !missing && asksForPackage ? String(packages[0]?.id || "") : "";
  const stage = packageId
    ? "package_review"
    : missing
      ? "collecting"
      : "qualified";
  const roman = intake.romanUrdu;
  const nicheLabel = niche ? ` ${niche.toLowerCase()}` : "";
  return {
    reply: packageId
      ? roman
        ? `Shukriya. Main ne aapki${nicheLabel} campaign details review ke liye save kar li hain. Package agency approval ke baad isi chat mein share hoga.`
        : `Thank you. I have saved your${nicheLabel} campaign details for review. The suitable package will be shared here after agency approval.`
      : missing
        ? roman
          ? `Shukriya, ${influencerName} ke collaboration ke liye aap apna ${missing} share kar dein.`
          : `Thank you for contacting us regarding ${influencerName}. Please share your ${missing} so I can assist you further.`
        : roman
          ? "Shukriya. Aapki details agency team ko review ke liye mil gayi hain. Team suitable collaboration option confirm karegi."
          : "Thank you. I have shared your inquiry with our team for review, and they will confirm the most suitable collaboration option.",
    stage,
    intent: "collaboration",
    handoffRequired: needsHuman,
    handoffReason: needsHuman ? "The client requested team assistance." : "",
    summary:
      c.summary ||
      `${brandName || contactName || "Brand"} inquiry for ${influencerName}`,
    contactName,
    brandName,
    email,
    phone,
    socialLinks,
    requirement,
    campaignType,
    productService,
    deliverables,
    reels: c.reels || 0,
    stories: c.stories || 0,
    posts: c.posts || 0,
    campaignDate,
    campaignDuration,
    location,
    specialRequirements: c.special_requirements || "",
    budget,
    shouldShareMediaKit: /\bmedia\s*kit\b/i.test(latest),
    packageId,
  } as z.infer<typeof decisionSchema>;
}

async function decide(
  c: Conversation,
  history: MessageRow[],
  influencer: any,
  packages: any[],
) {
  const settings = await getSettings();
  if (!config("AI_GATEWAY_API_KEY") && !config("VERCEL_OIDC_TOKEN"))
    return fallback(
      c,
      String(influencer?.data?.name || settings.name || "our creator"),
      String(influencer?.data?.niche || ""),
      history,
      packages,
    );
  const current = {
    contactName: c.contact_name || "",
    brandName: c.brand_name || "",
    email: c.email || "",
    phone: c.phone || "",
    socialLinks: JSON.parse(c.social_links || "[]"),
    requirement: c.requirement || "",
    campaignType: c.campaign_type || "",
    productService: c.product_service || "",
    deliverables: c.deliverables || "",
    reels: c.reels || 0,
    stories: c.stories || 0,
    posts: c.posts || 0,
    campaignDate: c.campaign_date || "",
    campaignDuration: c.campaign_duration || "",
    location: c.location || "",
    specialRequirements: c.special_requirements || "",
    budget: c.budget || "",
  };
  try {
    const result = await generateText({
      model: config("AI_MODEL") || "openai/gpt-6-luna",
      output: Output.object({ schema: decisionSchema }),
      system: `You are the PR inquiry assistant for ${settings.name || "Inspirers' Den"}. You represent ${influencer?.data?.name || "the agency"} (${influencer?.data?.niche || "creator"}). Default voice: ${nicheVoice(String(influencer?.data?.niche || ""))}. Influencer communication style: ${String(influencer?.data?.communicationStyle || "use the default voice")}. Influencer AI context: ${String(influencer?.data?.aiContext || "none supplied")}. Match the visitor's language; Roman Urdu is allowed. Be natural, concise, and professional: maximum three short sentences and one question at a time. Collect brand name, contact name, email/phone, social link, campaign type, product/service, deliverables and quantities, campaign date, duration, location, special requirements and budget. Never invent prices, metrics, availability, discounts or commitments. Follow the supplied pricing rules and only use supplied packages. A package recommendation, special pricing, negotiation, large/custom campaign, sensitive topic or unusual requirement requires human approval before sending. Set handoffRequired for payment, contract/legal topics, complaints, risk, ambiguity, or a request for a human. Media kit may be shared only when a real kit URL is supplied. Preserve already collected fields.`,
      prompt: `Current lead: ${JSON.stringify(current)}\nAvailable services: ${String(influencer?.data?.services || influencer?.data?.deliverables || "")}\nPricing rules: ${String(influencer?.data?.pricingRules || "No discounts or custom commitments without approval.")}\nCreator media kit: ${String(influencer?.data?.kit || "")}\nAvailable packages: ${JSON.stringify(packages.map((p) => ({ id: p.id, name: p.data.name, price: p.data.price, currency: p.data.currency, deliverables: p.data.deliverables })))}\nConversation:\n${history.map((m) => `${m.role}: ${m.content}`).join("\n")}`,
    });
    return result.output;
  } catch (error) {
    console.error("AI decision failed; using safe intake fallback", error);
    return fallback(
      c,
      String(influencer?.data?.name || settings.name || "our creator"),
      String(influencer?.data?.niche || ""),
      history,
      packages,
    );
  }
}

async function resolveInfluencer(message: InboundMessage) {
  const reference = trackingReference(message.text);
  if (reference) {
    const record = await getRecord(reference);
    if (
      record?.kind === "influencer" &&
      String(record.data.status || "Active") !== "Inactive"
    )
      return record;
  }
  if (message.provider === "instagram") {
    const connection = await db()
      .prepare(
        "SELECT influencer_id FROM connections WHERE platform='Instagram' AND external_account_id=? AND status='Connected'",
      )
      .bind(message.recipientId)
      .first<{ influencer_id: string }>();
    if (connection?.influencer_id && connection.influencer_id !== "agency") {
      const record = await getRecord(connection.influencer_id);
      if (
        record?.kind === "influencer" &&
        String(record.data.status || "Active") !== "Inactive"
      )
        return record;
    }
  }
  return null;
}

async function upsertLead(
  c: Conversation,
  decision: z.infer<typeof decisionSchema>,
  influencerId: string | null,
) {
  const existing = c.lead_id ? await getRecord(c.lead_id) : null;
  const current = existing?.kind === "lead" ? existing.data : {};
  const currentStatus = String(current.status || "New Inquiry");
  const aiManagedStatus = [
    "",
    "New",
    "New Inquiry",
    "Contacted",
    "AI Responded",
    "Information Requested",
    "Qualified",
  ].includes(currentStatus);
  const data = {
    ...current,
    name:
      decision.brandName ||
      decision.contactName ||
      String(current.name || "New brand inquiry"),
    contact: decision.contactName || String(current.contact || ""),
    email: decision.email || String(current.email || ""),
    phone: decision.phone || String(current.phone || ""),
    social: decision.socialLinks[0] || String(current.social || ""),
    requirement: decision.requirement || String(current.requirement || ""),
    campaignType:
      decision.campaignType || String(current.campaignType || "Other"),
    productService:
      decision.productService || String(current.productService || ""),
    deliverables:
      decision.deliverables || String(current.deliverables || ""),
    reels: decision.reels || Number(current.reels || 0),
    stories: decision.stories || Number(current.stories || 0),
    posts: decision.posts || Number(current.posts || 0),
    campaignDate:
      decision.campaignDate || String(current.campaignDate || ""),
    campaignDuration:
      decision.campaignDuration || String(current.campaignDuration || ""),
    location: decision.location || String(current.location || ""),
    specialRequirements:
      decision.specialRequirements ||
      String(current.specialRequirements || ""),
    budget: decision.budget || String(current.budget || ""),
    currency: String(current.currency || "PKR"),
    influencerId: influencerId || String(current.influencerId || ""),
    source: c.channel === "whatsapp" ? "WhatsApp" : "Instagram",
    platform: c.channel === "whatsapp" ? "WhatsApp" : "Instagram",
    reference: influencerId || String(current.reference || ""),
    assigned: String(current.assigned || ""),
    status: aiManagedStatus
      ? decision.stage === "package_review"
        ? "Awaiting Approval"
        : decision.stage === "qualified"
          ? "Qualified"
          : decision.stage === "collecting"
            ? "Information Requested"
            : "AI Responded"
      : currentStatus,
    notes: String(current.notes || "Managed by AI agent"),
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

async function scheduleAgentFollowUp(c: Conversation, reason: string) {
  const settings = await getSettings();
  const configuredHours = Number(settings.followupHours || 48);
  const hours = Number.isFinite(configuredHours)
    ? Math.min(336, Math.max(1, configuredHours))
    : 48;
  const dueAt = new Date(Date.now() + hours * 3_600_000).toISOString();
  const existing = await db()
    .prepare(
      "SELECT id FROM agent_actions WHERE conversation_id=? AND action_type='follow_up' AND status='pending' ORDER BY requested DESC LIMIT 1",
    )
    .bind(c.id)
    .first<{ id: string }>();
  const payload = JSON.stringify({ dueAt, reason });
  if (existing)
    await db()
      .prepare("UPDATE agent_actions SET payload=?,requested=? WHERE id=?")
      .bind(payload, now(), existing.id)
      .run();
  else
    await db()
      .prepare(
        "INSERT INTO agent_actions (id,conversation_id,action_type,payload,status,requested) VALUES (?,?,?,?,?,?)",
      )
      .bind(id(), c.id, "follow_up", payload, "pending", now())
      .run();
  if (!c.lead_id) return;
  const lead = await getRecord(c.lead_id);
  if (!lead || lead.kind !== "lead") return;
  await db()
    .prepare("UPDATE records SET data=?,updated=?,version=version+1 WHERE id=?")
    .bind(
      JSON.stringify({
        ...lead.data,
        followup: dueAt.slice(0, 10),
        followupStatus: "Awaiting customer reply",
      }),
      now(),
      lead.id,
    )
    .run();
}

export async function processInbound(
  message: InboundMessage,
  options: { forceDraft?: boolean } = {},
) {
  const duplicate = await db()
    .prepare("SELECT id FROM agent_messages WHERE provider_message_id=?")
    .bind(message.providerMessageId)
    .first();
  if (duplicate) return { duplicate: true };
  const reference = trackingReference(message.text);
  const influencer = await resolveInfluencer(message);
  const referencedThread =
    message.provider === "instagram"
      ? `${message.threadId}:${message.recipientId}`
      : reference
        ? `${message.threadId}:${reference}`
        : "";
  let conversationThread = referencedThread;
  let c = referencedThread
    ? await db()
        .prepare(
          "SELECT * FROM agent_conversations WHERE channel=? AND external_thread_id=?",
        )
        .bind(message.provider, referencedThread)
        .first<Conversation>()
    : await db()
        .prepare(
          "SELECT * FROM agent_conversations WHERE channel=? AND external_user_id=? ORDER BY last_message_at DESC LIMIT 1",
        )
        .bind(message.provider, message.senderId)
        .first<Conversation>();
  if (c && ["closed", "close"].includes(c.status)) {
    c = null;
    conversationThread = referencedThread
      ? `${referencedThread}:${Date.now()}`
      : "";
  }
  if (!c) {
    const stamp = now();
    c = {
      id: id(),
      channel: message.provider,
      external_thread_id: conversationThread || message.threadId,
      external_user_id: message.senderId,
      influencer_id: influencer?.id || null,
      lead_id: null,
      contact_name: message.senderName || null,
      brand_name: null,
      email: null,
      phone: null,
      social_links: "[]",
      requirement: null,
      campaign_type: null,
      product_service: null,
      deliverables: null,
      reels: 0,
      stories: 0,
      posts: 0,
      campaign_date: null,
      campaign_duration: null,
      location: null,
      special_requirements: null,
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
        "INSERT INTO agent_conversations (id,channel,external_thread_id,external_user_id,influencer_id,lead_id,contact_name,brand_name,email,phone,social_links,requirement,campaign_type,product_service,deliverables,reels,stories,posts,campaign_date,campaign_duration,location,special_requirements,budget,summary,status,stage,last_message_at,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
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
        c.campaign_type,
        c.product_service,
        c.deliverables,
        c.reels,
        c.stories,
        c.posts,
        c.campaign_date,
        c.campaign_duration,
        c.location,
        c.special_requirements,
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
  const pendingFollowUp = await db()
    .prepare(
      "SELECT id FROM agent_actions WHERE conversation_id=? AND action_type='follow_up' AND status='pending' LIMIT 1",
    )
    .bind(c.id)
    .first<{ id: string }>();
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
  await db()
    .prepare(
      "UPDATE agent_actions SET status='completed',decided=? WHERE conversation_id=? AND action_type='follow_up' AND status='pending'",
    )
    .bind(now(), c.id)
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
  c.campaign_type = decision.campaignType || c.campaign_type;
  c.product_service = decision.productService || c.product_service;
  c.deliverables = decision.deliverables || c.deliverables;
  c.reels = decision.reels || c.reels;
  c.stories = decision.stories || c.stories;
  c.posts = decision.posts || c.posts;
  c.campaign_date = decision.campaignDate || c.campaign_date;
  c.campaign_duration = decision.campaignDuration || c.campaign_duration;
  c.location = decision.location || c.location;
  c.special_requirements =
    decision.specialRequirements || c.special_requirements;
  c.budget = decision.budget || c.budget;
  c.summary = decision.summary || c.summary;
  c.stage = decision.stage;
  c.status = decision.handoffRequired ? "handoff" : "active";
  c.updated = now();
  c.last_message_at = c.updated;
  await upsertLead(c, decision, c.influencer_id);
  if (pendingFollowUp && c.lead_id) {
    const lead = await getRecord(c.lead_id);
    if (lead?.kind === "lead")
      await db()
        .prepare(
          "UPDATE records SET data=?,updated=?,version=version+1 WHERE id=?",
        )
        .bind(
          JSON.stringify({
            ...lead.data,
            followupStatus: "Customer replied",
          }),
          now(),
          lead.id,
        )
        .run();
  }
  await db()
    .prepare(
      "UPDATE agent_conversations SET influencer_id=?,lead_id=?,contact_name=?,brand_name=?,email=?,phone=?,social_links=?,requirement=?,campaign_type=?,product_service=?,deliverables=?,reels=?,stories=?,posts=?,campaign_date=?,campaign_duration=?,location=?,special_requirements=?,budget=?,summary=?,status=?,stage=?,last_message_at=?,updated=? WHERE id=?",
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
      c.campaign_type,
      c.product_service,
      c.deliverables,
      c.reels,
      c.stories,
      c.posts,
      c.campaign_date,
      c.campaign_duration,
      c.location,
      c.special_requirements,
      c.budget,
      c.summary,
      c.status,
      c.stage,
      c.last_message_at,
      c.updated,
      c.id,
    )
    .run();
  const autoDelivery =
    config("AGENT_AUTO_REPLY") === "true" && !options.forceDraft;
  let mediaKit = "";
  let mediaKitFileId = "";
  if (decision.shouldShareMediaKit && influencer?.data?.kitFileId) {
    mediaKitFileId = String(influencer.data.kitFileId);
    if (autoDelivery) {
      try {
        const url = await bucket().signedUrl(mediaKitFileId, 3600);
        mediaKit = `\n\nMedia kit (secure link, valid for 1 hour): ${url}`;
      } catch (error) {
        console.error("Unable to create media-kit link", error);
      }
    } else {
      mediaKit = "\n\nMedia kit: secure link will be generated when sent.";
    }
  } else if (decision.shouldShareMediaKit && influencer?.data?.kit) {
    const kit = String(influencer.data.kit);
    const url = kit.startsWith("/") ? config("APP_URL") + kit : kit;
    mediaKit = `\n\nMedia kit: ${url}`;
  }
  const reply = decision.reply + mediaKit;
  if (
    decision.packageId &&
    packageRows.some((p) => p.id === decision.packageId)
  ) {
    const pending = await db()
      .prepare(
        "SELECT id FROM agent_actions WHERE conversation_id=? AND action_type='send_package' AND status='pending' AND payload LIKE ? LIMIT 1",
      )
      .bind(c.id, '%"packageId":"' + decision.packageId + '"%')
      .first();
    if (!pending)
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
  }
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
        mediaKitFileId,
      }),
      "draft",
      now(),
    )
    .run();
  if (autoDelivery) {
    try {
      const providerId = await sendChannelMessage(
        c.channel,
        c.external_user_id,
        reply,
        await channelOptionsFor(c.channel, c.influencer_id),
      );
      await db()
        .prepare(
          "UPDATE agent_messages SET provider_message_id=?,status='sent' WHERE id=?",
        )
        .bind(providerId || null, outboundId)
        .run();
      await scheduleAgentFollowUp(c, "Awaiting customer reply");
    } catch (error) {
      await db()
        .prepare(
          "UPDATE agent_messages SET status='failed',metadata=? WHERE id=?",
        )
        .bind(
          JSON.stringify({
            intent: decision.intent,
            handoffReason: decision.handoffReason,
            error: error instanceof Error ? error.message : "Send failed",
          }),
          outboundId,
        )
        .run();
    }
  }
  return { conversationId: c.id, reply, status: c.status };
}
