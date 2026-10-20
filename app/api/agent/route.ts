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
} from "@/lib/server";
import { sendChannelMessage } from "@/lib/channels";
import { decrypt } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Conversation = {
  id: string;
  channel: string;
  external_user_id: string;
  influencer_id: string | null;
  lead_id: string | null;
  status: string;
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
async function channelOptions(c: Conversation) {
  if (c.channel !== "instagram") return {};
  const row = await db()
    .prepare(
      "SELECT external_account_id,token FROM connections WHERE influencer_id=? AND platform='Instagram' AND status='Connected'",
    )
    .bind(c.influencer_id || "agency")
    .first<{ external_account_id: string; token: string }>();
  if (!row?.token) return {};
  const tokens = await decrypt(row.token);
  return {
    token: String(tokens.access_token || ""),
    accountId: row.external_account_id,
  };
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
    return ok({ conversations: result.results });
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
        conversationId: z.string().uuid(),
        action: z.enum([
          "send",
          "pause",
          "resume",
          "handoff",
          "close",
          "approve",
          "reject",
        ]),
        text: z.string().max(4000).optional(),
        actionId: z.string().uuid().optional(),
      })
      .parse(await request.json());
    const c = await access(body.conversationId, user);
    if (["pause", "resume", "handoff", "close"].includes(body.action)) {
      const status = body.action === "resume" ? "active" : body.action;
      await db()
        .prepare("UPDATE agent_conversations SET status=?,updated=? WHERE id=?")
        .bind(status, now(), c.id)
        .run();
      return ok({ success: true, status });
    }
    if (body.action === "send") {
      const text = z.string().trim().min(1).max(4000).parse(body.text);
      const providerId = await sendChannelMessage(
        c.channel,
        c.external_user_id,
        text,
        await channelOptions(c),
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
      const providerId = await sendChannelMessage(
        c.channel,
        c.external_user_id,
        text,
        await channelOptions(c),
      );
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
            "human",
            text,
            JSON.stringify({ actionId: action.id }),
            "sent",
            now(),
          ),
        db()
          .prepare(
            "UPDATE agent_actions SET status='sent',decided=?,decided_by=? WHERE id=?",
          )
          .bind(now(), user.email, action.id),
      ]);
      return ok({ success: true });
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
