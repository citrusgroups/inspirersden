# Inspirers' Den — Client Demo Guide

## Demo order

1. **Overview** — creator count, connected accounts, new inquiries and active campaigns.
2. **Influencers** — create an influencer, upload a profile photo, review the profile and generate its tracked WhatsApp link.
3. **Social Connections** — connect agency or influencer Instagram, Facebook, TikTok and Gmail accounts through official authorization.
4. **Packages and Media Kits** — show reusable commercial packages and creator documents.
5. **Tracking Links** — explain that every creator uses the same agency WhatsApp number, but each generated link identifies the creator source.
6. **Agent Inbox** — click **Create test inquiry**, then show the complete conversation, influencer attribution, generated lead, AI/safe-fallback draft, human handoff, package approval and lead snapshot. Use **Deal confirmed** to demonstrate final pipeline synchronization.
7. **Leads and Campaigns** — move the inquiry through the pipeline until it is confirmed or closed.
8. **Team Members** — create a single-use invitation for a manager or influencer portal account.
9. **Reports and Activity Log** — show performance and the audit history of important actions.

## Image storage behavior

- A profile photo selected while creating or editing an influencer is uploaded to the configured private Supabase Storage bucket.
- Uploaded media kits and attachments use the same private storage flow.
- The browser never receives the Supabase service-role key.
- Permanently deleting an influencer also removes that influencer's stored files and related records. If storage cleanup ever fails, the API reports that cleanup is pending instead of silently hiding it.

## Local installation

1. Extract the project into its own folder.
2. Copy your existing `.env.local` into the project root. Do not share this file.
3. Run `npm install`.
4. Run `npm run db:setup` if the database schema has not been applied yet.
5. Run `npm run dev`.

The production checks for this package are `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
