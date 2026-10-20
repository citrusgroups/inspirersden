import { readJson, type JsonObject } from "@/lib/json";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  db,
  bucket,
  config,
  requireUser,
  admin,
  staff,
  canRead,
  canWrite,
  seed,
  unpack,
  getRecord,
  getSettings,
  auditAction,
  now,
  id,
  hash,
  fail,
} from "@/lib/server";
import { validateRecord, inquirySchema } from "@/lib/validation";
import {
  oauthReady,
  startOAuth,
  finishOAuth,
  disconnectOAuth,
} from "@/lib/oauth";
import type { Entry, Member } from "@/lib/types";
import { creators as suppliedCreators } from "@/lib/seed";
import { detachCreator } from "@/lib/relations.mjs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const ok = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const secure = () => config("APP_URL").startsWith("https://");
async function saveSession(access: string, refresh?: string) {
  const jar = await cookies();
  jar.set("id_access", access, {
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });
  if (refresh)
    jar.set("id_refresh", refresh, {
      httpOnly: true,
      secure: secure(),
      sameSite: "lax",
      path: "/",
      maxAge: 2592000,
    });
}
async function supabase(
  path: string,
  body?: unknown,
  method = "POST",
  token?: string,
) {
  if (!config("SUPABASE_URL") || !config("SUPABASE_ANON_KEY"))
    fail("Configure Supabase Auth in .env.local and restart the server.", 503);
  const r = await fetch(config("SUPABASE_URL") + "/auth/v1/" + path, {
    method,
    headers: {
      apikey: config("SUPABASE_ANON_KEY"),
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    data = await readJson(r);
  } catch {
    data = {};
  }
  if (!r.ok)
    fail(
      data.msg ||
        data.error_description ||
        data.message ||
        "Authentication failed",
      r.status,
    );
  return data;
}
async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\//, "").split("/");
    const action = path[0];
    const read = request.method === "GET";
    if (!read) {
      const origin = request.headers.get("origin");
      if (
        (origin && origin !== url.origin) ||
        request.headers.get("sec-fetch-site") === "cross-site"
      )
        fail("Invalid request origin.", 403);
    }
    if (action === "branding" && read) {
      if (path[1] === "file") {
        const meta = await db()
          .prepare("SELECT * FROM files WHERE id=? AND record_id='agency'")
          .bind(path[2])
          .first<{ mime: string }>();
        if (!meta || !meta.mime.startsWith("image/"))
          fail("Brand asset not found", 404);
        const image = await bucket().get(path[2]);
        if (!image) fail("Brand asset not found", 404);
        return new Response(image.body, {
          headers: {
            "Content-Type": meta.mime,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "public, max-age=60",
          },
        });
      }
      const settings = await getSettings();
      return ok({ name: settings.name, logo: settings.logo });
    }
    if (action === "auth") {
      if (read && path[1] === "config")
        return ok({
          configured: !!(config("SUPABASE_URL") && config("SUPABASE_ANON_KEY")),
        });
      if (read) fail("Method not allowed", 405);
      const mode = path[1];
      const body = (await request.json()) as JsonObject;
      const jar = await cookies();
      if (mode === "logout") {
        const token = jar.get("id_access")?.value;
        if (token)
          await supabase("logout", {}, "POST", token).catch(() => null);
        jar.delete("id_access");
        jar.delete("id_refresh");
        return ok({ success: true });
      }
      if (mode === "refresh") {
        const rt = jar.get("id_refresh")?.value;
        if (!rt) fail("Session expired", 401);
        const data = await supabase("token?grant_type=refresh_token", {
          refresh_token: rt,
        });
        await saveSession(data.access_token, data.refresh_token);
        return ok({ success: true });
      }
      if (mode === "session") {
        const tokens = z
          .object({
            access_token: z.string().min(20).max(10000),
            refresh_token: z.string().max(10000).optional(),
          })
          .parse(body);
        const user = await supabase(
          "user",
          undefined,
          "GET",
          tokens.access_token,
        );
        if (!user.email_confirmed_at)
          fail("Please verify your email first.", 403);
        await saveSession(tokens.access_token, tokens.refresh_token);
        return ok({ success: true });
      }
      if (mode === "password") {
        const password = z.string().min(8).max(128).parse(body.password);
        const token = jar.get("id_access")?.value;
        if (!token)
          fail(
            "Use your email authentication session to change the password.",
            401,
          );
        await supabase("user", { password }, "PUT", token);
        return ok({ success: true });
      }
      const email = z.string().email().max(200).parse(body.email);
      if (mode === "recover") {
        await supabase(
          "recover?redirect_to=" +
            encodeURIComponent(config("APP_URL") + "/auth/reset"),
          { email },
        );
        return ok({
          message: "If an account exists, a recovery link has been sent.",
        });
      }
      if (mode === "resend") {
        await supabase("resend", { type: "signup", email });
        return ok({ message: "Check your email for the verification link." });
      }
      const password = z
        .string()
        .min(mode === "signup" ? 8 : 1)
        .max(128)
        .parse(body.password);
      if (mode === "signup") {
        const name = z.string().trim().min(2).max(100).parse(body.name);
        const data = await supabase(
          "signup?redirect_to=" +
            encodeURIComponent(config("APP_URL") + "/auth/verify"),
          { email, password, data: { name } },
        );
        if (data.access_token && data.user?.email_confirmed_at)
          await saveSession(data.access_token, data.refresh_token);
        return ok({
          message: "Check your email to verify your account before signing in.",
        });
      }
      if (mode === "login") {
        const data = await supabase("token?grant_type=password", {
          email,
          password,
        });
        const verified = await supabase(
          "user",
          undefined,
          "GET",
          data.access_token,
        );
        if (!verified.email_confirmed_at)
          fail("Please verify your email first.", 403);
        await saveSession(data.access_token, data.refresh_token);
        return ok({ success: true });
      }
      fail("Unknown authentication action", 404);
    }
    if (action === "creators" && read) {
      const initialized = await db()
        .prepare("SELECT id FROM preferences WHERE id=?")
        .bind("initialized")
        .first();
      if (!initialized)
        return ok({
          creators: suppliedCreators.map((c) => ({
            name: c.name,
            niche: c.niche,
            handle: c.handle,
            platform: c.platform,
            image: String(c.image).startsWith("/brand/")
              ? c.image
              : "/brand/plans.jpg",
          })),
        });
      const rows = (
        await db()
          .prepare(
            "SELECT data FROM records WHERE kind='influencer' ORDER BY created",
          )
          .all<{ data: string }>()
      ).results;
      return ok({
        creators: rows
          .map((r) => JSON.parse(r.data) as JsonObject)
          .filter((c) => c.status !== "Inactive")
          .map((c) => ({
            name: c.name,
            niche: c.niche,
            handle: c.handle,
            platform: c.platform,
            image: String(c.image).startsWith("/brand/")
              ? c.image
              : "/brand/plans.jpg",
          })),
      });
    }
    if (action === "inquiry") {
      if (read) fail("Method not allowed", 405);
      const data = inquirySchema.parse((await request.json()) as JsonObject);
      const ip = request.headers.get("cf-connecting-ip") || "unknown";
      const key = await hash(ip);
      const limit = await db()
        .prepare(
          "SELECT COUNT(*) AS n FROM audit WHERE actor=? AND action='Public inquiry' AND created>?",
        )
        .bind(key, new Date(Date.now() - 60000).toISOString())
        .first<{ n: number }>();
      if ((limit?.n || 0) >= 3)
        fail("Please wait a minute before submitting another inquiry.", 429);
      const recordId = "LEAD-" + id().slice(0, 8).toUpperCase();
      await db().batch([
        db()
          .prepare(
            "INSERT INTO records (id,kind,data,created,updated,version) VALUES (?,?,?,?,?,1)",
          )
          .bind(
            recordId,
            "lead",
            JSON.stringify({
              name: data.company || data.name,
              contact: data.name,
              email: data.email,
              phone: data.phone,
              requirement: data.message,
              budgetRange: data.budget,
              type: data.type,
              status: "New",
              source: "Website",
              platform: "Website",
              assigned: "",
              notes: "",
            }),
            now(),
            now(),
          ),
        db()
          .prepare(
            "INSERT INTO audit (id,actor,action,record_id,created) VALUES (?,?,?,?,?)",
          )
          .bind(id(), key, "Public inquiry", recordId, now()),
      ]);
      return ok(
        { message: "Thank you. Your inquiry has been received.", id: recordId },
        201,
      );
    }
    const user = await requireUser();
    if (action === "state" && read) {
      await seed(user);
      const result = await db()
        .prepare("SELECT * FROM records ORDER BY updated DESC")
        .all<Entry>();
      const records = result.results
        .map(unpack)
        .filter((r) => canRead(user, r))
        .map((r) =>
          user.role === "Influencer"
            ? {
                ...r,
                data: {
                  ...r.data,
                  notes: "",
                  assigned: "",
                  portalInvitation: "",
                },
              }
            : r,
        );
      const permitted = new Set(records.map((r) => r.id));
      const clicks = (
        await db().prepare("SELECT * FROM clicks ORDER BY created DESC").all()
      ).results.filter((r) => permitted.has(String(r.influencer_id)));
      const files = (
        await db().prepare("SELECT * FROM files ORDER BY created DESC").all()
      ).results.filter((r) => permitted.has(String(r.record_id)));
      const connections = (
        await db()
          .prepare(
            "SELECT id,influencer_id,platform,status,username,avatar,connected,synced,expires FROM connections",
          )
          .all()
      ).results
        .filter(
          (r) =>
            permitted.has(String(r.influencer_id)) ||
            (staff(user) && String(r.influencer_id) === "agency"),
        )
        .map((r) => ({
          ...r,
          status:
            r.status === "Connected" && String(r.expires) < now()
              ? "Connection Expired"
              : r.status,
        }));
      const activities = (
        await db()
          .prepare("SELECT * FROM audit ORDER BY created DESC LIMIT 250")
          .all()
      ).results.filter(
        (r) => admin(user) || permitted.has(String(r.record_id)),
      );
      return ok({
        user,
        records,
        clicks,
        files,
        connections,
        audit: activities,
        members: admin(user)
          ? (await db().prepare("SELECT * FROM members ORDER BY created").all())
              .results
          : [user],
        settings: await getSettings(),
        authConfigured: !!(
          config("SUPABASE_URL") && config("SUPABASE_ANON_KEY")
        ),
        integrationReady: Object.fromEntries(
          ["Instagram", "Facebook", "TikTok", "Gmail"].map((p) => [
            p,
            oauthReady(p),
          ]),
        ),
      });
    }
    if (action === "records") {
      if (read && path[1] && path[2] === "versions") {
        const entry = await getRecord(path[1]);
        if (!entry || !canRead(user, entry)) fail("Record unavailable", 404);
        const history = (
          await db()
            .prepare(
              "SELECT * FROM versions WHERE record_id=? ORDER BY version DESC",
            )
            .bind(entry.id)
            .all()
        ).results;
        return ok(
          user.role === "Influencer"
            ? history.map((v) => ({
                ...v,
                data: JSON.stringify({
                  ...JSON.parse(String(v.data)),
                  notes: "",
                  assigned: "",
                }),
              }))
            : history,
        );
      }
      if (read && path[1] && path[2] === "activity") {
        const entry = await getRecord(path[1]);
        if (!entry || !canRead(user, entry)) fail("Record unavailable", 404);
        return ok(
          (
            await db()
              .prepare(
                "SELECT * FROM audit WHERE record_id=? ORDER BY created DESC",
              )
              .bind(entry.id)
              .all()
          ).results,
        );
      }
      if (path[1] && path[2] === "delete") {
        if (read) fail("Method not allowed", 405);
        if (!admin(user))
          fail("Only an agency owner or admin can delete an influencer.", 403);
        const confirmation = z
          .object({ confirm: z.string(), version: z.number().int().positive() })
          .parse((await request.json()) as JsonObject);
        const removed = await db().transaction(async (tx) => {
          const raw = await tx
            .prepare("SELECT * FROM records WHERE id=? FOR UPDATE")
            .bind(path[1])
            .first<Entry>();
          if (!raw || raw.kind !== "influencer")
            fail("Influencer not found.", 404);
          const creator = unpack(raw);
          if (creator.version !== confirmation.version)
            fail("This profile changed. Reload before deleting.", 409);
          if (String(creator.data.name) !== confirmation.confirm)
            fail("Type the exact influencer name to confirm deletion.");
          const active = await tx
            .prepare(
              "SELECT id FROM connections WHERE influencer_id=? AND status='Connected' LIMIT 1",
            )
            .bind(creator.id)
            .first();
          if (active)
            fail(
              "Disconnect the creator’s social accounts before deleting the profile.",
              409,
            );
          const files = (
            await tx
              .prepare("SELECT id FROM files WHERE record_id=?")
              .bind(creator.id)
              .all<{ id: string }>()
          ).results;
          const related = (
            await tx
              .prepare(
                "SELECT * FROM records WHERE kind IN ('lead','campaign','package') FOR UPDATE",
              )
              .all<Entry>()
          ).results;
          for (const linked of related) {
            const item = unpack(linked);
            const changed = detachCreator(item.data, creator.id);
            if (changed)
              await tx
                .prepare(
                  "UPDATE records SET data=?,updated=?,version=version+1 WHERE id=?",
                )
                .bind(JSON.stringify(changed), now(), item.id)
                .run();
          }
          await tx
            .prepare(
              "UPDATE members SET active=0,influencer_id=NULL WHERE influencer_id=?",
            )
            .bind(creator.id)
            .run();
          for (const table of [
            "files",
            "clicks",
            "connections",
            "invites",
            "oauth_states",
          ]) {
            await tx
              .prepare(
                "DELETE FROM " +
                  table +
                  " WHERE " +
                  (table === "files" ? "record_id" : "influencer_id") +
                  "=?",
              )
              .bind(creator.id)
              .run();
          }
          await tx
            .prepare("DELETE FROM versions WHERE record_id=?")
            .bind(creator.id)
            .run();
          await tx
            .prepare("DELETE FROM records WHERE id=?")
            .bind(creator.id)
            .run();
          await tx
            .prepare(
              "INSERT INTO audit (id,actor,action,record_id,created) VALUES (?,?,?,?,?)",
            )
            .bind(
              id(),
              user.email,
              "Deleted influencer: " + creator.data.name,
              creator.id,
              now(),
            )
            .run();
          return files.map((f) => f.id);
        });
        const cleanup = await Promise.allSettled(
          removed.map((key) => bucket().delete(key)),
        );
        const pending = cleanup.filter(
          (result) => result.status === "rejected",
        ).length;
        if (pending)
          console.error(
            "Storage cleanup pending for",
            pending,
            "deleted influencer files",
          );
        return ok({ success: true, storageCleanupPending: pending });
      }

      if (read) fail("Use dashboard state to read records.", 405);
      const body = (await request.json()) as JsonObject;
      let entry = path[1] ? await getRecord(path[1]) : null;
      const kind = entry?.kind || body.kind;
      if (path[1] && !entry) fail("Record not found", 404);
      if (entry && !canWrite(user, entry))
        fail("You do not have permission to edit this record.", 403);
      if (!entry && !staff(user))
        fail("Only agency staff can create records.", 403);
      if (user.role === "Manager" && kind === "package")
        fail("Package changes require an admin.", 403);
      const data = validateRecord(kind, body.data);
      if (!entry && kind === "influencer" && !data.email)
        fail(
          "An email is required to generate the influencer portal invitation.",
        );
      if (
        kind === "campaign" &&
        data.start &&
        data.end &&
        data.end < data.start
      )
        fail("End date must follow start date.");
      if (user.role === "Manager") data.assigned = user.email;
      if (user.role === "Influencer" && entry) {
        data.notes = String(entry.data.notes || "");
        data.assigned = String(entry.data.assigned || "");
        data.status = String(entry.data.status || "Pending");
      }
      for (const rid of [
        ...((data.influencerIds as string[]) || []),
        ...(data.influencerId ? [String(data.influencerId)] : []),
      ]) {
        const influencer = await getRecord(rid);
        if (
          !influencer ||
          influencer.kind !== "influencer" ||
          !canRead(user, influencer)
        )
          fail("Select an accessible influencer.");
      }
      const recordId =
        entry?.id ||
        kind.slice(0, 3).toUpperCase() +
          "-" +
          id().replaceAll("-", "").toUpperCase();
      const slug =
        entry?.slug ||
        (kind === "influencer"
          ? String(data.name)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .slice(0, 70) +
            "-" +
            id().slice(0, 8)
          : null);
      const merged = { ...entry?.data, ...data };
      let autoToken = "";
      if (!entry && kind === "influencer") {
        autoToken = id() + id();
        merged.portalInvitation =
          config("APP_URL") +
          "/auth/invite?token=" +
          encodeURIComponent(autoToken);
      }
      const version = (entry?.version || 0) + 1;
      if (entry && body.version !== entry.version)
        fail("This record changed. Close the form, reload and try again.", 409);
      if (entry) {
        const changed = await db()
          .prepare(
            "UPDATE records SET data=?,updated=?,version=? WHERE id=? AND version=?",
          )
          .bind(JSON.stringify(merged), now(), version, recordId, entry.version)
          .run();
        if (!changed.meta.changes)
          fail("This record changed. Reload and try again.", 409);
      } else {
        const insert = db()
          .prepare(
            "INSERT INTO records (id,kind,slug,data,created,updated,version) VALUES (?,?,?,?,?,?,?)",
          )
          .bind(
            recordId,
            kind,
            slug,
            JSON.stringify(merged),
            now(),
            now(),
            version,
          );
        if (autoToken)
          await db().batch([
            insert,
            db()
              .prepare(
                "INSERT INTO invites (id,token_hash,email,role,influencer_id,expires,used) VALUES (?,?,?,?,?,?,0)",
              )
              .bind(
                id(),
                await hash(autoToken),
                String(data.email).toLowerCase(),
                "Influencer",
                recordId,
                new Date(Date.now() + 604800000).toISOString(),
              ),
          ]);
        else await insert.run();
      }
      if (kind === "package")
        await db()
          .prepare(
            "INSERT INTO versions (id,record_id,version,data,created) VALUES (?,?,?,?,?)",
          )
          .bind(id(), recordId, version, JSON.stringify(merged), now())
          .run();
      await auditAction(
        user,
        (entry ? "Updated " : "Created ") + kind + ": " + data.name,
        recordId,
      );
      entry = await getRecord(recordId);
      return ok({ record: entry }, entry ? 200 : 201);
    }
    if (action === "invite") {
      if (read) fail("Method not allowed", 405);
      const data = (await request.json()) as JsonObject;
      if (path[1] === "accept") {
        const token = z.string().min(40).max(200).parse(data.token);
        const invitation = await db()
          .prepare(
            "SELECT * FROM invites WHERE token_hash=? AND email=? AND used=0 AND expires>?",
          )
          .bind(await hash(token), user.email, now())
          .first<{ id: string; role: string; influencer_id: string | null }>();
        if (!invitation)
          fail("Invitation is invalid, expired, or belongs to another email.");
        if (invitation.influencer_id) {
          const target = await getRecord(invitation.influencer_id);
          if (
            !target ||
            (target.data.email &&
              String(target.data.email).toLowerCase() !== user.email)
          )
            fail("This profile email has changed. Request a new invitation.");
        }
        const accepted = await db().batch([
          db()
            .prepare(
              "UPDATE members SET role=?,influencer_id=?,active=1 WHERE id=? AND EXISTS (SELECT 1 FROM invites WHERE id=? AND used=0 AND email=? AND expires>?)",
            )
            .bind(
              invitation.role,
              invitation.influencer_id,
              user.id,
              invitation.id,
              user.email,
              now(),
            ),
          db()
            .prepare("UPDATE invites SET used=1 WHERE id=? AND used=0")
            .bind(invitation.id),
        ]);
        if (!accepted[0].meta.changes || !accepted[1].meta.changes)
          fail("This invitation has already been accepted.");
        await auditAction(
          user,
          "Accepted invitation",
          invitation.influencer_id || undefined,
        );
        return ok({ success: true });
      }
      if (!admin(user)) fail("Invitations require an admin.", 403);
      const email = z.string().email().parse(data.email).toLowerCase();
      const existing = await db()
        .prepare("SELECT role FROM members WHERE email=?")
        .bind(email)
        .first<{ role: string }>();
      if (existing?.role === "Agency Owner")
        fail("The owner account cannot be invited into another role.");
      const role = z.enum(["Admin", "Manager", "Influencer"]).parse(data.role);
      if (role === "Admin" && user.role !== "Agency Owner")
        fail("Only the owner can invite an admin.", 403);
      const influencerId =
        typeof data.influencerId === "string" ? data.influencerId : null;
      if (role === "Influencer") {
        const r = influencerId ? await getRecord(influencerId) : null;
        if (!r || r.kind !== "influencer")
          fail("Select an influencer profile for this invitation.");
        if (r.data.email && String(r.data.email).toLowerCase() !== email)
          fail("Use the email recorded on this influencer profile.");
      }
      const token = id() + id();
      await db()
        .prepare(
          "INSERT INTO invites (id,token_hash,email,role,influencer_id,expires,used) VALUES (?,?,?,?,?,?,0)",
        )
        .bind(
          id(),
          await hash(token),
          email,
          role,
          influencerId,
          new Date(Date.now() + 604800000).toISOString(),
        )
        .run();
      await auditAction(
        user,
        "Created " + role + " invitation for " + email,
        influencerId || undefined,
      );
      return ok({
        url:
          config("APP_URL") + "/auth/invite?token=" + encodeURIComponent(token),
        message:
          "Copy and share this invitation with " +
          email +
          ". Valid for 7 days.",
      });
    }
    if (action === "team") {
      if (read || user.role !== "Agency Owner")
        fail("Only the owner can manage permissions.", 403);
      const data = z
        .object({
          id: z.string(),
          role: z.enum(["Admin", "Manager", "Influencer"]),
          active: z.boolean(),
        })
        .parse((await request.json()) as JsonObject);
      const target = await db()
        .prepare("SELECT * FROM members WHERE id=?")
        .bind(data.id)
        .first<Member>();
      if (!target || target.role === "Agency Owner")
        fail("The owner account cannot be changed.");
      await db()
        .prepare("UPDATE members SET role=?,active=? WHERE id=?")
        .bind(data.role, data.active ? 1 : 0, data.id)
        .run();
      await auditAction(user, "Changed team permissions: " + target.email);
      return ok({ success: true });
    }
    if (action === "settings") {
      if (read) fail("Method not allowed", 405);
      if (!admin(user)) fail("Settings require an admin.", 403);
      const data = z
        .object({
          name: z.string().min(2).max(100),
          email: z.string().email(),
          phone: z.string().max(40),
          whatsapp: z.string().regex(/^\d{8,15}$/),
          instagram: z
            .string()
            .url()
            .refine((v) => v.startsWith("https://")),
          website: z
            .string()
            .url()
            .refine((v) => v.startsWith("https://"))
            .or(z.literal("")),
          logo: z.string().max(500),
          notifications: z.boolean(),
        })
        .parse((await request.json()) as JsonObject);
      await db()
        .prepare(
          "INSERT INTO preferences (id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        )
        .bind("agency", JSON.stringify(data))
        .run();
      await auditAction(user, "Updated agency settings");
      return ok({ success: true });
    }
    if (action === "profile") {
      if (read) fail("Method not allowed", 405);
      const name = z
        .string()
        .trim()
        .min(2)
        .max(100)
        .parse(((await request.json()) as JsonObject).name);
      await db()
        .prepare("UPDATE members SET name=? WHERE id=?")
        .bind(name, user.id)
        .run();
      return ok({ success: true });
    }
    if (action === "upload") {
      if (read) fail("Method not allowed", 405);
      const form = await request.formData();
      const recordId = String(form.get("recordId") || "");
      const entry = await getRecord(recordId);
      const isLogo =
        recordId === "agency" && form.get("purpose") === "logo" && admin(user);
      if (!isLogo && (!entry || !canWrite(user, entry)))
        fail("Upload not permitted", 403);
      const file = form.get("file");
      if (
        !(file instanceof File) ||
        file.size === 0 ||
        file.size > 10 * 1024 * 1024
      )
        fail("Select a file up to 10 MB.");
      const allowed = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
      ];
      if (!allowed.includes(file.type))
        fail("Only PDF, JPEG, PNG and WebP files are accepted.");
      if (
        (isLogo || form.get("purpose") === "avatar") &&
        !file.type.startsWith("image/")
      )
        fail("Select an image for the logo or profile photo.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const signature = Array.from(bytes.slice(0, 12));
      const valid =
        file.type === "application/pdf"
          ? new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
          : file.type === "image/jpeg"
            ? signature[0] === 255 && signature[1] === 216
            : file.type === "image/png"
              ? [137, 80, 78, 71, 13, 10, 26, 10].every(
                  (v, i) => signature[i] === v,
                )
              : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
                new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
      if (!valid) fail("The file contents do not match its type.");
      const fileId = id();
      await bucket().put(fileId, bytes, {
        httpMetadata: { contentType: file.type },
      });
      try {
        await db()
          .prepare(
            "INSERT INTO files (id,record_id,name,mime,size,created) VALUES (?,?,?,?,?,?)",
          )
          .bind(
            fileId,
            recordId,
            file.name.slice(0, 200),
            file.type,
            file.size,
            now(),
          )
          .run();
        if (isLogo) {
          const settings = await getSettings();
          await db()
            .prepare("UPDATE preferences SET data=? WHERE id=?")
            .bind(
              JSON.stringify({
                ...settings,
                logo: "/api/branding/file/" + fileId,
              }),
              "agency",
            )
            .run();
        }
        if (
          entry &&
          form.get("purpose") === "avatar" &&
          file.type.startsWith("image/")
        ) {
          const data = { ...entry.data, image: "/api/file/" + fileId };
          await db()
            .prepare(
              "UPDATE records SET data=?,updated=?,version=version+1 WHERE id=?",
            )
            .bind(JSON.stringify(data), now(), recordId)
            .run();
        }
      } catch (error) {
        await bucket().delete(fileId);
        throw error;
      }
      await auditAction(user, "Uploaded " + file.name, recordId);
      return ok({
        id: fileId,
        ...(isLogo ? { logo: "/api/branding/file/" + fileId } : {}),
      });
    }
    if (action === "file" && read) {
      const meta = await db()
        .prepare("SELECT * FROM files WHERE id=?")
        .bind(path[1])
        .first<{ record_id: string; name: string; mime: string }>();
      const entry = meta ? await getRecord(meta.record_id) : null;
      if (!meta || !entry || !canRead(user, entry)) fail("File not found", 404);
      const file = await bucket().get(path[1]);
      if (!file) fail("File not found", 404);
      return new Response(file.body, {
        headers: {
          "Content-Type": meta.mime,
          "Content-Disposition":
            (url.searchParams.get("download") ? "attachment" : "inline") +
            '; filename="' +
            meta.name.replace(/[^a-zA-Z0-9._ -]/g, "") +
            '"',
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (action === "oauth") {
      const platform = {
        instagram: "Instagram",
        facebook: "Facebook",
        tiktok: "TikTok",
        gmail: "Gmail",
      }[path[1] as "instagram"];
      if (!platform) fail("Unknown provider");
      if (read && path[2] === "callback") {
        const state = url.searchParams.get("state") || "";
        const jar = await cookies();
        const stateHash = await hash(state);
        if (jar.get("oauth_state")?.value !== stateHash)
          fail("Authorization state mismatch", 403);
        jar.delete("oauth_state");
        const pending = await db()
          .prepare(
            "SELECT influencer_id FROM oauth_states WHERE id=? AND user_id=? AND platform=? AND expires>?",
          )
          .bind(stateHash, user.id, platform, now())
          .first<{ influencer_id: string }>();
        const agencyTarget = pending?.influencer_id === "agency";
        const influencer =
          pending && !agencyTarget
            ? await getRecord(pending.influencer_id)
            : null;
        if (
          !pending ||
          (agencyTarget
            ? !admin(user)
            : !influencer || !canWrite(user, influencer))
        )
          fail("Authorization expired or access changed. Start again.", 403);
        try {
          if (url.searchParams.has("error")) {
            await db()
              .prepare("DELETE FROM oauth_states WHERE id=?")
              .bind(stateHash)
              .run();
            fail("Permission Required");
          }
          const recordId = await finishOAuth(
            user,
            platform,
            url.searchParams.get("code") || "",
            state,
          );
          await auditAction(user, "Connected " + platform, recordId);
          return Response.redirect(
            new URL("/dashboard/social?connection=Connected", url.origin),
            303,
          );
        } catch (error) {
          const status =
            (error as Error).message === "Permission Required"
              ? "Permission Required"
              : "Connection Error";
          await db()
            .prepare(
              "INSERT INTO connections (id,influencer_id,platform,status) VALUES (?,?,?,?) ON CONFLICT(influencer_id,platform) DO UPDATE SET status=excluded.status",
            )
            .bind(
              id(),
              agencyTarget ? "agency" : influencer!.id,
              platform,
              status,
            )
            .run();
          return Response.redirect(
            new URL(
              "/dashboard/social?connection=" + encodeURIComponent(status),
              url.origin,
            ),
            303,
          );
        }
      }
      if (read) fail("Method not allowed", 405);
      const body = (await request.json()) as JsonObject;
      const targetId = String(body.influencerId);
      const agencyTarget = targetId === "agency";
      const entry = agencyTarget ? null : await getRecord(targetId);
      if (
        agencyTarget
          ? !admin(user)
          : !entry || entry.kind !== "influencer" || !canWrite(user, entry)
      )
        fail("Connection not permitted", 403);
      if (path[2] === "disconnect") {
        await disconnectOAuth(targetId, platform);
        await auditAction(user, "Disconnected " + platform, targetId);
        return ok({ success: true });
      }
      const result = await startOAuth(user, platform, targetId);
      (await cookies()).set("oauth_state", await hash(result.state), {
        httpOnly: true,
        secure: secure(),
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      });
      return ok({ url: result.url });
    }
    fail("Not found", 404);
  } catch (error) {
    if (error instanceof z.ZodError)
      return ok(
        {
          error: error.issues
            .map((i) => i.path.join(".") + ": " + i.message)
            .join("; "),
        },
        400,
      );
    const e = error as Error & { status?: number };
    console.error("API error:", e.message);
    return ok(
      {
        error: e.status
          ? e.message
          : "This action could not be completed. Please try again.",
      },
      e.status || 500,
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
