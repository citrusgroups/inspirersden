-- Application tables. Access is granted only by the trusted server connection.
CREATE TABLE IF NOT EXISTS "audit" (
	"id" text PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"record_id" text,
	"created" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "audit_record" ON "audit" ("record_id");
CREATE TABLE IF NOT EXISTS "clicks" (
	"id" text PRIMARY KEY NOT NULL,
	"influencer_id" text NOT NULL,
	"platform" text NOT NULL,
	"campaign" text,
	"created" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "clicks_influencer_date" ON "clicks" ("influencer_id","created");
CREATE TABLE IF NOT EXISTS "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"influencer_id" text NOT NULL,
	"platform" text NOT NULL,
	"status" text NOT NULL,
	"username" text,
	"avatar" text,
	"connected" text,
	"synced" text,
	"token" text,
	"expires" text
);

ALTER TABLE "connections" ADD COLUMN IF NOT EXISTS "external_account_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "connections_account" ON "connections" ("influencer_id","platform");
CREATE TABLE IF NOT EXISTS "files" (
	"id" text PRIMARY KEY NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"created" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "files_record" ON "files" ("record_id");
CREATE TABLE IF NOT EXISTS "invites" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"influencer_id" text,
	"expires" text NOT NULL,
	"used" integer DEFAULT 0 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "invites_token" ON "invites" ("token_hash");
CREATE TABLE IF NOT EXISTS "members" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"influencer_id" text,
	"active" integer DEFAULT 1 NOT NULL,
	"created" text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "members_email" ON "members" ("email");
CREATE TABLE IF NOT EXISTS "oauth_states" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"influencer_id" text NOT NULL,
	"platform" text NOT NULL,
	"expires" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "records" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"slug" text,
	"data" text NOT NULL,
	"created" text NOT NULL,
	"updated" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);

CREATE INDEX IF NOT EXISTS "records_kind" ON "records" ("kind");
CREATE UNIQUE INDEX IF NOT EXISTS "records_slug" ON "records" ("slug");
CREATE TABLE IF NOT EXISTS "versions" (
	"id" text PRIMARY KEY NOT NULL,
	"record_id" text NOT NULL,
	"version" integer NOT NULL,
	"data" text NOT NULL,
	"created" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "agent_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"external_thread_id" text NOT NULL,
	"external_user_id" text NOT NULL,
	"influencer_id" text,
	"lead_id" text,
	"contact_name" text,
	"brand_name" text,
	"email" text,
	"phone" text,
	"social_links" text DEFAULT '[]' NOT NULL,
	"requirement" text,
	"budget" text,
	"summary" text,
	"status" text DEFAULT 'active' NOT NULL,
	"stage" text DEFAULT 'greeting' NOT NULL,
	"last_message_at" text NOT NULL,
	"created" text NOT NULL,
	"updated" text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_conversation_thread" ON "agent_conversations" ("channel","external_thread_id");
CREATE INDEX IF NOT EXISTS "agent_conversation_influencer" ON "agent_conversations" ("influencer_id","last_message_at");

CREATE TABLE IF NOT EXISTS "agent_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"provider_message_id" text,
	"direction" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" text DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'saved' NOT NULL,
	"created" text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_provider_message" ON "agent_messages" ("provider_message_id") WHERE "provider_message_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "agent_message_conversation" ON "agent_messages" ("conversation_id","created");

CREATE TABLE IF NOT EXISTS "agent_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"action_type" text NOT NULL,
	"payload" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested" text NOT NULL,
	"decided" text,
	"decided_by" text,
	"error" text
);

CREATE INDEX IF NOT EXISTS "agent_action_conversation" ON "agent_actions" ("conversation_id","requested");

CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"payload" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"error" text,
	"created" text NOT NULL,
	"processed" text
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_external_event" ON "webhook_events" ("provider","external_id");

ALTER TABLE public.audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.audit FROM anon, authenticated;
ALTER TABLE public.clicks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.clicks FROM anon, authenticated;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.connections FROM anon, authenticated;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.files FROM anon, authenticated;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.invites FROM anon, authenticated;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.members FROM anon, authenticated;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.oauth_states FROM anon, authenticated;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.preferences FROM anon, authenticated;
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.records FROM anon, authenticated;
ALTER TABLE public.versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.versions FROM anon, authenticated;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_conversations FROM anon, authenticated;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_messages FROM anon, authenticated;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_actions FROM anon, authenticated;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.webhook_events FROM anon, authenticated;
