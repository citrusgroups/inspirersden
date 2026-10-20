import { config, db, id, now } from "@/lib/server";
/* Meta webhook payload shapes differ by subscribed event type. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  parseInstagram,
  parseWhatsApp,
  verifyMetaSignature,
} from "@/lib/channels";
import { processInbound } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const url = new URL(request.url);
  const token =
    provider === "whatsapp"
      ? config("WHATSAPP_VERIFY_TOKEN")
      : config("INSTAGRAM_VERIFY_TOKEN");
  if (
    url.searchParams.get("hub.mode") === "subscribe" &&
    token &&
    url.searchParams.get("hub.verify_token") === token
  )
    return new Response(url.searchParams.get("hub.challenge") || "");
  return new Response("Verification failed", { status: 403 });
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!["whatsapp", "instagram"].includes(provider))
    return Response.json({ error: "Unknown provider" }, { status: 404 });
  const raw = await request.text();
  if (
    !verifyMetaSignature(
      raw,
      request.headers.get("x-hub-signature-256"),
      provider,
    )
  )
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const eventId =
    request.headers.get("x-request-id") ||
    (await crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(raw))
      .then((b) => Buffer.from(b).toString("hex")));
  const eventKey = provider + ":" + eventId;
  const exists = await db()
    .prepare("SELECT id FROM webhook_events WHERE provider=? AND external_id=?")
    .bind(provider, eventKey)
    .first();
  if (exists) return Response.json({ received: true, duplicate: true });
  const rowId = id();
  await db()
    .prepare(
      "INSERT INTO webhook_events (id,provider,external_id,payload,status,created) VALUES (?,?,?,?,?,?)",
    )
    .bind(rowId, provider, eventKey, raw, "processing", now())
    .run();
  try {
    const messages =
      provider === "whatsapp"
        ? parseWhatsApp(payload)
        : parseInstagram(payload);
    for (const message of messages) await processInbound(message);
    await db()
      .prepare(
        "UPDATE webhook_events SET status='processed',processed=? WHERE id=?",
      )
      .bind(now(), rowId)
      .run();
    return Response.json({ received: true, messages: messages.length });
  } catch (error) {
    await db()
      .prepare(
        "UPDATE webhook_events SET status='failed',error=?,processed=? WHERE id=?",
      )
      .bind(
        error instanceof Error ? error.message : "Unknown error",
        now(),
        rowId,
      )
      .run();
    console.error("Webhook processing failed", error);
    return Response.json({ received: true, processing: "failed" });
  }
}
