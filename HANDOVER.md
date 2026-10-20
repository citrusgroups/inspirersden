# Inspirers’ Den — Handover

## Included

- Full branded website and protected agency dashboard.
- Influencer, lead, package, campaign, contact, team, tracking, report and file management.
- Unique tracked WhatsApp link and QR code for every influencer.
- Agency/influencer social account authorization.
- WhatsApp and Instagram agent backend, conversation history and lead capture.
- Niche-aware replies, human handoff and admin-only package approval.
- Agent Inbox for monitoring, manual replies, pause/resume and approvals.

## Launch checklist

1. Copy `.env.example` to `.env.local` and enter Supabase, AI and Meta credentials.
2. Run `npm install`, then `npm run db:setup`.
3. Run `npm run test`, `npm run lint`, `npm run typecheck` and `npm run build`.
4. Deploy on a public HTTPS domain and update `APP_URL`.
5. Register `/api/webhooks/whatsapp` and `/api/webhooks/instagram` in Meta.
6. Test with `AGENT_AUTO_REPLY=false`; confirm saved drafts and manual sends in Agent Inbox.
7. Set `AGENT_AUTO_REPLY=true` only after approval of the final scripts and successful provider tests.

## Important

No password or API secret belongs in source control. WhatsApp/Instagram live delivery depends on the client's Meta accounts, permissions and app review. Provider, AI, hosting and database usage charges are separate from the software build.
