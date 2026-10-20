import { readJson } from "@/lib/json";
import { config, fail, hash, id, now, db } from "./server";
import type { Member } from "./types";
const providers = ["Instagram", "Facebook", "TikTok", "Gmail"];
export function oauthReady(platform: string) {
  if (!config("APP_URL") || !config("TOKEN_ENCRYPTION_KEY")) return false;
  if (platform === "Gmail")
    return !!(config("GOOGLE_CLIENT_ID") && config("GOOGLE_CLIENT_SECRET"));
  if (platform === "TikTok")
    return !!(config("TIKTOK_CLIENT_KEY") && config("TIKTOK_CLIENT_SECRET"));
  return !!(
    config("META_APP_ID") &&
    config("META_APP_SECRET") &&
    config("META_GRAPH_VERSION")
  );
}
function callback(p: string) {
  return config("APP_URL") + "/api/oauth/" + p.toLowerCase() + "/callback";
}
export async function encrypt(value: unknown) {
  const bytes = Uint8Array.from(atob(config("TOKEN_ENCRYPTION_KEY")), (c) =>
    c.charCodeAt(0),
  );
  if (bytes.length !== 32)
    fail(
      "TOKEN_ENCRYPTION_KEY must contain a base64 encoded 32-byte key.",
      503,
    );
  const key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(JSON.stringify(value)),
    ),
  );
  return btoa(String.fromCharCode(...iv, ...encrypted));
}
export async function decrypt(value: string) {
  const bytes = Uint8Array.from(atob(config("TOKEN_ENCRYPTION_KEY")), (c) =>
    c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "decrypt",
  ]);
  const packed = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  return JSON.parse(
    new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: packed.slice(0, 12) },
        key,
        packed.slice(12),
      ),
    ),
  );
}
export async function startOAuth(
  u: Member,
  platform: string,
  influencerId: string,
) {
  if (!providers.includes(platform)) fail("Unknown platform");
  if (!oauthReady(platform))
    fail(
      "API setup required. Configure this provider and complete app approval before connecting.",
      503,
    );
  const state = id() + id();
  await db()
    .prepare(
      "INSERT INTO oauth_states (id,user_id,influencer_id,platform,expires) VALUES (?,?,?,?,?)",
    )
    .bind(
      await hash(state),
      u.id,
      influencerId,
      platform,
      new Date(Date.now() + 600000).toISOString(),
    )
    .run();
  let url: URL;
  if (platform === "Gmail") {
    url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: config("GOOGLE_CLIENT_ID"),
      redirect_uri: callback(platform),
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "consent",
    }).toString();
  } else if (platform === "TikTok") {
    url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.search = new URLSearchParams({
      client_key: config("TIKTOK_CLIENT_KEY"),
      redirect_uri: callback(platform),
      response_type: "code",
      scope: "user.info.basic,user.info.profile",
      state,
    }).toString();
  } else {
    url = new URL(
      "https://www.facebook.com/" +
        config("META_GRAPH_VERSION") +
        "/dialog/oauth",
    );
    url.search = new URLSearchParams({
      client_id: config("META_APP_ID"),
      redirect_uri: callback(platform),
      response_type: "code",
      scope:
        platform === "Instagram"
          ? "pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_messages"
          : "public_profile",
      state,
    }).toString();
  }
  return { url: url.toString(), state };
}
async function safeJson(r: Response) {
  const data = await readJson(r);
  if (!r.ok || (data.error && data.error.code !== "ok"))
    fail(
      "Provider authorization failed. Please reconnect and check permissions.",
      400,
    );
  return data;
}
export async function finishOAuth(
  u: Member,
  platform: string,
  code: string,
  state: string,
) {
  const stateId = await hash(state);
  const row = await db()
    .prepare(
      "DELETE FROM oauth_states WHERE id=? AND user_id=? AND platform=? AND expires>? RETURNING *",
    )
    .bind(stateId, u.id, platform, now())
    .first<{ influencer_id: string }>();
  if (!row) fail("This authorization link has expired. Start again.", 400);
  let tokens,
    username = "",
    avatar = "",
    externalAccountId = "",
    expires = 3600;
  if (platform === "Gmail") {
    tokens = await safeJson(
      await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          code,
          client_id: config("GOOGLE_CLIENT_ID"),
          client_secret: config("GOOGLE_CLIENT_SECRET"),
          redirect_uri: callback(platform),
          grant_type: "authorization_code",
        }),
      }),
    );
    const profile = await safeJson(
      await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: "Bearer " + tokens.access_token },
      }),
    );
    username = profile.email;
    avatar = profile.picture || "";
    expires = tokens.expires_in;
  } else if (platform === "TikTok") {
    tokens = await safeJson(
      await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: config("TIKTOK_CLIENT_KEY"),
          client_secret: config("TIKTOK_CLIENT_SECRET"),
          code,
          grant_type: "authorization_code",
          redirect_uri: callback(platform),
        }),
      }),
    );
    const profile = await safeJson(
      await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
        { headers: { Authorization: "Bearer " + tokens.access_token } },
      ),
    );
    if (profile.error?.code && profile.error.code !== "ok")
      fail("Profile permission required");
    username = profile.data?.user?.display_name || "";
    avatar = profile.data?.user?.avatar_url || "";
    externalAccountId = profile.data?.user?.open_id || "";
    expires = tokens.expires_in;
  } else {
    const base = "https://graph.facebook.com/" + config("META_GRAPH_VERSION");
    const exchange = new URL(base + "/oauth/access_token");
    exchange.search = new URLSearchParams({
      client_id: config("META_APP_ID"),
      client_secret: config("META_APP_SECRET"),
      redirect_uri: callback(platform),
      code,
    }).toString();
    tokens = await safeJson(await fetch(exchange));
    if (platform === "Facebook") {
      const profile = await safeJson(
        await fetch(
          base +
            "/me?fields=id,name,picture&access_token=" +
            encodeURIComponent(tokens.access_token),
        ),
      );
      username = profile.name;
      avatar = profile.picture?.data?.url || "";
      externalAccountId = profile.id || "";
    } else {
      const profile = await safeJson(
        await fetch(
          base +
            "/me/accounts?fields=instagram_business_account{id,username,profile_picture_url}&access_token=" +
            encodeURIComponent(tokens.access_token),
        ),
      );
      const accounts =
        profile.data?.filter(
          (p: { instagram_business_account?: unknown }) =>
            p.instagram_business_account,
        ) || [];
      if (accounts.length !== 1)
        fail(
          "Link exactly one professional Instagram account to your Facebook Page, then reconnect. Account selection is required when multiple Pages are linked.",
        );
      username = accounts[0].instagram_business_account.username;
      avatar = accounts[0].instagram_business_account.profile_picture_url || "";
      externalAccountId = accounts[0].instagram_business_account.id || "";
    }
    expires = tokens.expires_in || 3600;
  }
  if (!username) fail("Profile permission required.");
  await db()
    .prepare(
      "INSERT INTO connections (id,influencer_id,platform,status,username,avatar,connected,synced,token,expires,external_account_id) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(influencer_id,platform) DO UPDATE SET status=excluded.status,username=excluded.username,avatar=excluded.avatar,connected=excluded.connected,synced=excluded.synced,token=excluded.token,expires=excluded.expires,external_account_id=excluded.external_account_id",
    )
    .bind(
      id(),
      row.influencer_id,
      platform,
      "Connected",
      username,
      avatar,
      now(),
      now(),
      await encrypt(tokens),
      new Date(Date.now() + expires * 1000).toISOString(),
      externalAccountId,
    )
    .run();
  return row.influencer_id;
}
export async function disconnectOAuth(influencerId: string, platform: string) {
  const r = await db()
    .prepare(
      "SELECT token FROM connections WHERE influencer_id=? AND platform=?",
    )
    .bind(influencerId, platform)
    .first<{ token: string }>();
  if (r?.token) {
    const tokens = await decrypt(r.token);
    let response: Response;
    if (platform === "Gmail")
      response = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: tokens.refresh_token || tokens.access_token,
        }),
      });
    else if (platform === "TikTok")
      response = await fetch("https://open.tiktokapis.com/v2/oauth/revoke/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: config("TIKTOK_CLIENT_KEY"),
          client_secret: config("TIKTOK_CLIENT_SECRET"),
          token: tokens.access_token,
        }),
      });
    else
      response = await fetch(
        "https://graph.facebook.com/" +
          config("META_GRAPH_VERSION") +
          "/me/permissions?access_token=" +
          encodeURIComponent(tokens.access_token),
        { method: "DELETE" },
      );
    if (!response.ok)
      fail(
        "Provider revocation failed. Retry or remove access in the provider account settings.",
        502,
      );
  }
  await db()
    .prepare(
      "UPDATE connections SET status=?,token=NULL WHERE influencer_id=? AND platform=?",
    )
    .bind("Not Connected", influencerId, platform)
    .run();
}
