import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [
  dashboard,
  inbox,
  agentApi,
  webhook,
  agent,
  uploadApi,
  tracking,
  schema,
] = await Promise.all([
  read("components/dashboard.tsx"),
  read("components/agent-inbox.tsx"),
  read("app/api/agent/route.ts"),
  read("app/api/webhooks/[provider]/route.ts"),
  read("lib/agent.ts"),
  read("app/api/[...path]/route.ts"),
  read("app/go/[slug]/route.ts"),
  read("supabase/schema.sql"),
]);

assert.match(dashboard, /<AgentInbox/);
assert.match(inbox, /Create test inquiry/);
assert.match(inbox, /Delete test inquiry/);
for (const action of ["send-draft", "confirm", "simulate", "delete"])
  assert.match(agentApi, new RegExp(`"${action}"`));
assert.match(agentApi, /Only test inquiries can be deleted/);
assert.match(webhook, /processInbound\(message\)/);
assert.match(agent, /channelOptionsFor\(c\.channel, c\.influencer_id\)/);
assert.match(agent, /kitFileId/);
assert.match(uploadApi, /purpose === "media-kit"/);
assert.match(tracking, /Reference:.*entry\.id/s);
for (const table of [
  "agent_conversations",
  "agent_messages",
  "agent_actions",
  "webhook_events",
]) {
  assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`));
}

console.log(
  "PASS: dashboard, tracking link, webhook, agent inbox, approval and media-kit workflow are connected.",
);
