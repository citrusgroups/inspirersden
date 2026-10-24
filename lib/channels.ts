import { createHmac, timingSafeEqual } from "node:crypto";
/* Provider webhook JSON is intentionally parsed defensively. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { cleanMessage } from "./agent-utils.mjs";
import { config, db, fail } from "./server";
import { decrypt } from "./oauth";

export type InboundMessage = {
  provider: "whatsapp" | "instagram";
  providerMessageId: string;
  threadId: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  text: string;
};

export function verifyMetaSignature(
  raw: string,
  signature: string | null,
  provider: string,
) {
  const secret =
    provider === "whatsapp"
      ? config("WHATSAPP_APP_SECRET") || config("META_APP_SECRET")
      : config("META_APP_SECRET");
  if (!secret) return config("NODE_ENV") !== "production";
  if (!signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(
    "sha256=" + createHmac("sha256", secret).update(raw).digest("hex"),
  );
  const supplied = Buffer.from(signature);
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}

export function parseWhatsApp(payload: any): InboundMessage[] {
  const output: InboundMessage[] = [];
  for (const entry of payload?.entry || [])
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      const names = new Map(
        (value.contacts || []).map((c: any) => [
          c.wa_id,
          c.profile?.name || "",
        ]),
      );
      for (const message of value.messages || [])
        if (message?.type === "text" && message?.text?.body)
          output.push({
            provider: "whatsapp",
            providerMessageId: String(message.id),
            threadId: String(message.from),
            senderId: String(message.from),
            recipientId: String(value.metadata?.phone_number_id || ""),
            senderName: String(names.get(message.from) || ""),
            text: cleanMessage(message.text.body),
          });
    }
  return output;
}

export function parseInstagram(payload: any): InboundMessage[] {
  const output: InboundMessage[] = [];
  for (const entry of payload?.entry || [])
    for (const event of entry?.messaging || []) {
      if (event?.message?.is_echo || !event?.message?.text) continue;
      output.push({
        provider: "instagram",
        providerMessageId: String(
          event.message.mid || `${entry.id}-${event.timestamp}`,
        ),
        threadId: String(event.sender?.id || ""),
        senderId: String(event.sender?.id || ""),
        recipientId: String(event.recipient?.id || entry.id || ""),
        senderName: "",
        text: cleanMessage(event.message.text),
      });
    }
  return output;
}

async function graph(path: string, token: string, body: unknown) {
  if (!token) fail("Messaging access token is not configured.", 503);
  const response = await fetch(
    `https://graph.facebook.com/${config("META_GRAPH_VERSION") || "v24.0"}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    fail(
      (data as any)?.error?.message || "The provider rejected this message.",
      502,
    );
  return data as { messages?: { id: string }[]; message_id?: string };
}

export async function sendChannelMessage(
  channel: string,
  recipient: string,
  text: string,
  options: { token?: string; accountId?: string } = {},
) {
  if (channel === "whatsapp") {
    const accountId = options.accountId || config("WHATSAPP_PHONE_NUMBER_ID");
    if (!accountId) fail("WHATSAPP_PHONE_NUMBER_ID is not configured.", 503);
    const result = await graph(
      `${accountId}/messages`,
      options.token || config("WHATSAPP_ACCESS_TOKEN"),
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: { preview_url: false, body: cleanMessage(text) },
      },
    );
    return result.messages?.[0]?.id || "";
  }
  const accountId =
    options.accountId || config("INSTAGRAM_BUSINESS_ACCOUNT_ID");
  if (!accountId) fail("INSTAGRAM_BUSINESS_ACCOUNT_ID is not configured.", 503);
  const result = await graph(
    `${accountId}/messages`,
    options.token || config("INSTAGRAM_ACCESS_TOKEN"),
    { recipient: { id: recipient }, message: { text: cleanMessage(text) } },
  );
  return result.message_id || "";
}

export async function channelOptionsFor(
  channel: string,
  influencerId: string | null,
) {
  if (channel !== "instagram") return {};
  const targets = influencerId ? [influencerId, "agency"] : ["agency"];
  for (const target of targets) {
    const row = await db()
      .prepare(
        "SELECT external_account_id,token FROM connections WHERE influencer_id=? AND platform='Instagram' AND status='Connected'",
      )
      .bind(target)
      .first<{ external_account_id: string; token: string }>();
    if (!row?.token) continue;
    const tokens = await decrypt(row.token);
    return {
      token: String(tokens.access_token || ""),
      accountId: row.external_account_id,
    };
  }
  return {};
}
