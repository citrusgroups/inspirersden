# Inspirers’ Den — Client Scope Check

## Included in the completed system

- Public Home, About and Contact pages in the supplied Inspirers’ Den brand theme.
- Supabase email signup, verification, login, recovery and protected dashboard access.
- Agency Owner, Admin, Manager and Influencer roles with invitations and permissions.
- Influencer add, edit, archive, delete, search, filters, profile details and media-kit uploads.
- Automatic unique influencer ID, portal invitation, tracked WhatsApp URL and downloadable QR code.
- One central agency WhatsApp number with influencer reference inside every tracked message link.
- Click, inquiry and confirmed-conversion reporting by influencer and source.
- Agency-level Instagram, Facebook, TikTok and Gmail identity connection controls.
- Influencer-level Instagram, Facebook, TikTok and Gmail identity connection controls.
- Official OAuth consent only; the application never asks for social-account passwords.
- Leads, packages, campaigns, contacts, team, reports, activity log and agency settings.
- Secure private file storage, server-side authorization, validation and audit history.
- WhatsApp and Instagram webhook receiving with duplicate-event protection.
- Influencer identification from the tracked WhatsApp reference or connected Instagram account.
- Influencer niche-based AI conversation voice with language matching.
- Automatic brand/contact/social/campaign/budget detail collection and lead updates.
- Central Agent Inbox with complete message history, manual replies, pause/resume and human handoff.
- Media-kit awareness and package recommendation workflow.
- Agency Owner/Admin approval before any recommended package is sent.

## Provider-dependent activation items

- Meta app review and production access for Instagram messaging.
- WhatsApp Cloud API number, permanent access token and webhook subscription.
- AI Gateway key/model and the final decision to enable `AGENT_AUTO_REPLY`.
- TikTok, Gmail and Facebook inbox automation is not included; these remain account/profile connections.

Live activation cannot be completed without the client-owned provider accounts, approvals and secrets. They must be added only through deployment environment variables, never committed to the project.
