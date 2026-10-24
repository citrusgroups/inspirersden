import { z } from "zod";
/* Provider payloads and persisted JSON are validated at their trust boundaries. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  db,
  requireUser,
  staff,
  admin,
  fail,
  id,
  now,
  getRecord,
  auditAction,
  config,
  bucket,
} from "@/lib/server";
import { channelOptionsFor, sendChannelMessage } from "@/lib/channels";
import { processInbound } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Conversation = {
  id: string;
  channel: string;
  external_user_id: string;
  influencer_id: string | null;
  lead_id: string | null;
  status: string;
  stage: string;
};
const ok = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function access(
  idValue: string,
  user: Awaited<ReturnType<typeof requireUser>>,
) {
  const row = await db()
    .prepare("SELECT * FROM agent_conversations WHERE id=?")
    .bind(idValue)
    .first<Conversation>();
  if (!row || (!staff(user) && row.influencer_id !== user.influencer_id))
    fail("Conversation unavailable.", 404);
  return row;
}
async function updateLead(
  leadId: string | null,
  patch: Record<string, string>,
) {
  if (!leadId) return;
  const lead = await getRecord(leadId);
  if (!lead || lead.kind !== "lead") return;
  await db()
    .prepare("UPDATE records SET data=?,updated=?,version=version+1 WHERE id=?")
    .bind(JSON.stringify({ ...lead.data, ...patch }), now(), lead.id)
    .run();
}
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const requested = url.searchParams.get("conversationId");
    if (requested) {
      const conversation = await access(requested, user);
      const messages = (
        await db()
          .prepare(
            "SELECT * FROM agent_messages WHERE conversation_id=? ORDER BY created",
          )
          .bind(requested)
          .all()
      ).results;
      const actions = (
        await db()
          .prepare(
            "SELECT * FROM agent_actions WHERE conversation_id=? ORDER BY requested DESC",
          )
          .bind(requested)
          .all()
      ).results.map((a: any) => ({ ...a, payload: JSON.parse(a.payload) }));
      return ok({ conversation, messages, actions });
    }
    const sql = staff(user)
      ? "SELECT * FROM agent_conversations ORDER BY last_message_at DESC LIMIT 250"
      : "SELECT * FROM agent_conversations WHERE influencer_id=? ORDER BY last_message_at DESC LIMIT 250";
    const result = staff(user)
      ? await db().prepare(sql).all()
      : await db().prepare(sql).bind(user.influencer_id).all();
    const connectedInstagram = await db()
      .prepare(
        "SELECT id FROM connections WHERE platform='Instagram' AND status='Connected' AND token IS NOT NULL LIMIT 1",
      )
      .first();
    return ok({
      conversations: result.results,
      configuration: {
        ai: Boolean(
          config("AI_GATEWAY_API_KEY") || config("VERCEL_OIDC_TOKEN"),
        ),
        whatsapp: Boolean(
          config("WHATSAPP_ACCESS_TOKEN") &&
          config("WHATSAPP_PHONE_NUMBER_ID") &&
          (config("WHATSAPP_APP_SECRET") || config("META_APP_SECRET")),
        ),
        instagram: Boolean(
          (config("INSTAGRAM_ACCESS_TOKEN") &&
            config("INSTAGRAM_BUSINESS_ACCOUNT_ID")) ||
          connectedInstagram,
        ),
        autoReply: config("AGENT_AUTO_REPLY") === "true",
      },
    });
  } catch (error) {
    return ok(
      { error: error instanceof Error ? error.message : "Request failed" },
      (error as { status?: number }).status || 500,
    );
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      fail("Invalid request origin.", 403);
    const body = z
      .object({
        conversationId: z.string().uuid().optional(),
        action: z.enum([
          "send",
          "send-draft",
          "pause",
          "resume",
          "handoff",
          "close",
          "confirm",
          "approve",
          "reject",
          "simulate",
        ]),
        text: z.string().max(4000).optional(),
        actionId: z.string().uuid().optional(),
        messageId: z.string().uuid().optional(),
        influencerId: z.string().max(100).optional(),
      })
      .parse(await request.json());
    if (body.action === "simulate") {
      if (!admin(user)) fail("Only an admin can create a demo inquiry.", 403);
      const selected = body.influencerId
        ? await getRecord(body.influencerId)
        : null;
      if (selected && selected.kind !== "influencer")
        fail("Select an influencer for the demo inquiry.");
      const first = selected
        ? { id: selected.id }
        : await db()
            .prepare(
              "SELECT id FROM records WHERE kind='influencer' AND data NOT LIKE '%\"status\":\"Inactive\"%' ORDER BY updated DESC LIMIT 1",
            )
            .first<{ id: string }>();
      if (!first?.id) fail("Add an active influencer before running the demo.");
      const demoId = id();
      const result = await processInbound(
        {
          provider: "whatsapp",
          providerMessageId: "demo-" + demoId,
          threadId: "demo-" + demoId,
          senderId: "923000000000",
          recipientId: config("WHATSAPP_PHONE_NUMBER_ID") || "demo-agency",
          senderName: "Sara Khan",
          text: `Salam, I am Sara from Northstar Brand, humein product promotion campaign karwani hai. Budget: PKR 150,000. Email sara@northstar.example and profile https://instagram.com/northstar. Please share rates and package. Reference: ${first.id}`,
        },
        { forceDraft: true },
      );
      await auditAction(user, "Created agent demo inquiry", first.id);
      return ok({ success: true, conversationId: result.conversationId });
    }
    const conversationId = z.string().uuid().parse(body.conversationId);
    const c = await access(conversationId, user);
    if (
      ["pause", "resume", "handoff", "close", "confirm"].includes(body.action)
    ) {
      if (["close", "confirm"].includes(body.action) && !staff(user))
        fail("Only agency staff can close or confirm a deal.", 403);
      const status =
        body.action === "resume"
          ? "active"
          : body.action === "close" || body.action === "confirm"
            ? "closed"
            : body.action;
      const stage =
        body.action === "confirm"
          ? "confirmed"
          : body.action === "close"
            ? "closed"
            : c.stage;
      await db()
        .prepare(
          "UPDATE agent_conversations SET status=?,stage=?,updated=? WHERE id=?",
        )
        .bind(status, stage, now(), c.id)
        .run();
      if (body.action === "confirm")
        await updateLead(c.lead_id, { status: "Confirmed" });
      if (body.action === "close")
        await updateLead(c.lead_id, { status: "Closed" });
      await auditAction(
        user,
        body.action === "confirm"
          ? "Confirmed agent-assisted deal"
          : `Changed conversation status to ${status}`,
        c.lead_id || undefined,
      );
      return ok({ success: true, status });
    }
    if (body.action === "send") {
      const text = z.string().trim().min(1).max(4000).parse(body.text);
      const providerId = await sendChannelMessage(
        c.channel,
        c.external_user_id,
        text,
        await channelOptionsFor(c.channel, c.influencer_id),
      );
      await db()
        .prepare(
          "INSERT INTO agent_messages (id,conversation_id,provider_message_id,direction,role,content,metadata,status,created) VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id(),
          c.id,
          providerId || null,
          "outbound",
          "human",
          text,
          "{}",
          "sent",
          now(),
        )
        .run();
      await db()
        .prepare(
          "UPDATE agent_conversations SET last_message_at=?,updated=? WHERE id=?",
        )
        .bind(now(), now(), c.id)
        .run();
      return ok({ success: true });
    }
    if (body.action === "send-draft") {
      const draft = await db()
        .prepare(
          "SELECT id,content,metadata FROM agent_messages WHERE id=? AND conversation_id=? AND direction='outbound' AND status IN ('draft','failed')",
        )
        .bind(z.string().uuid().parse(body.messageId), c.id)
        .first<{ id: string; content: string; metadata: string }>();
      if (!draft) fail("Draft is no longer available.", 404);
      let linkedActionId = "";
      let mediaKitFileId = "";
      try {
        const metadata = JSON.parse(draft.metadata || "{}");
        linkedActionId = String(metadata.actionId || "");
        mediaKitFileId = String(metadata.mediaKitFileId || "");
      } catch {}
      if (linkedActionId) {
        const approved = await db()
          .prepare(
            "SELECT id FROM agent_actions WHERE id=? AND conversation_id=? AND status='approved'",
          )
          .bind(linkedActionId, c.id)
          .first();
        if (!approved)
          fail(
            "This package approval is no longer valid. Review it again.",
            409,
          );
      }
      let outboundContent = draft.content;
      if (mediaKitFileId) {
        const url = await bucket().signedUrl(mediaKitFileId, 3600);
        outboundContent = outboundContent.replace(
          "Media kit: secure link will be generated when sent.",
          `Media kit (secure link, valid for 1 hour): ${url}`,
        );
      }
      const providerId = await sendChannelMessage(
        c.channel,
        c.external_user_id,
        outboundContent,
        await channelOptionsFor(c.channel, c.influencer_id),
      );
      await db().batch([
        db()
          .prepare(
            "UPDATE agent_messages SET provider_message_id=?,content=?,status='sent' WHERE id=?",
          )
          .bind(providerId || null, outboundContent, draft.id),
        db()
          .prepare(
            "UPDATE agent_conversations SET last_message_at=?,updated=? WHERE id=?",
          )
          .bind(now(), now(), c.id),
      ]);
      if (linkedActionId) {
        await db()
          .prepare(
            "UPDATE agent_actions SET status='sent',error=NULL WHERE id=? AND conversation_id=? AND status='approved'",
          )
          .bind(linkedActionId, c.id)
          .run();
        await updateLead(c.lead_id, {
          packageSent: new Date().toISOString().slice(0, 10),
        });
      }
      return ok({ success: true });
    }
    if (!admin(user)) fail("Package approval requires an admin.", 403);
    const actionId = z.string().uuid().parse(body.actionId);
    const action = await db()
      .prepare(
        "SELECT * FROM agent_actions WHERE id=? AND conversation_id=? AND status='pending'",
      )
      .bind(actionId, c.id)
      .first<{ id: string; payload: string }>();
    if (!action) fail("Pending action not found.", 404);
    if (body.action === "reject") {
      await db()
        .prepare(
          "UPDATE agent_actions SET status='rejected',decided=?,decided_by=? WHERE id=?",
        )
        .bind(now(), user.email, action.id)
        .run();
      return ok({ success: true });
    }
    const payload = JSON.parse(action.payload);
    const pkg = await getRecord(String(payload.packageId || ""));
    if (!pkg || pkg.kind !== "package") fail("Package no longer exists.", 404);
    const text = `Recommended package: ${pkg.data.name}\nPrice: ${pkg.data.currency || "PKR"} ${Number(pkg.data.price || 0).toLocaleString()}\nDeliverables: ${pkg.data.deliverables}`;
    try {
      const deliverNow = config("AGENT_AUTO_REPLY") === "true";
      const providerId = deliverNow
        ? await sendChannelMessage(
            c.channel,
            c.external_user_id,
            text,
            await channelOptionsFor(c.channel, c.influencer_id),
          )
        : "";
      await db().batch([
        db()
          .prepare(
            "INSERT INTO agent_messages (id,conversation_id,provider_message_id,direction,role,content,metadata,status,created) VALUES (?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            id(),
            c.id,
            providerId || null,
            "outbound",
            "assistant",
            text,
            JSON.stringify({ actionId: action.id }),
            deliverNow ? "sent" : "draft",
            now(),
          ),
        db()
          .prepare(
            "UPDATE agent_actions SET status=?,decided=?,decided_by=? WHERE id=?",
          )
          .bind(deliverNow ? "sent" : "approved", now(), user.email, action.id),
        db()
          .prepare(
            "UPDATE agent_conversations SET stage='package_sent',updated=? WHERE id=?",
          )
          .bind(now(), c.id),
      ]);
      await updateLead(c.lead_id, {
        status: "Package Suggested",
        packageId: pkg.id,
        packageName: String(pkg.data.name || ""),
        ...(deliverNow
          ? { packageSent: new Date().toISOString().slice(0, 10) }
          : { packageApproved: new Date().toISOString().slice(0, 10) }),
      });
      await auditAction(
        user,
        `${deliverNow ? "Sent" : "Approved"} package: ${pkg.data.name}`,
        c.lead_id || undefined,
      );
      return ok({ success: true, delivered: deliverNow });
    } catch (error) {
      await db()
        .prepare("UPDATE agent_actions SET error=? WHERE id=?")
        .bind(error instanceof Error ? error.message : "Send failed", action.id)
        .run();
      throw error;
    }
  } catch (error) {
    return ok(
      { error: error instanceof Error ? error.message : "Request failed" },
      (error as { status?: number }).status || 500,
    );
  }
}
