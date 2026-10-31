# Promised Scope Compliance

This build was checked against both client scope documents on 31 October 2026.

## Delivered in the application

- Central dashboard for influencers, inquiries, campaigns, packages, media kits, tracking, conversations, follow-ups, approvals, notifications, reports, activity and settings.
- Influencer profiles with unique IDs, tracked WhatsApp links, niche, social profiles, services, media kits, packages, pricing rules, communication style and AI context.
- One agency WhatsApp number with an influencer-specific `Reference: INF-...` in each generated link.
- Official WhatsApp and supported Instagram webhook processing with influencer attribution and complete stored conversation history.
- Influencer-specific AI behavior using niche, services, communication style, AI context, packages and pricing rules.
- Structured campaign intake for brand/contact information, campaign type, product/service, content quantities, deliverables, date, duration, budget, location and special requirements.
- Lead creation and the promised lead stages: New Inquiry, AI Responded, Information Requested, Qualified, Negotiation, Awaiting Approval, Proposal / Package Sent, Follow-up, Converted, Closed and Not Interested.
- Private media-kit storage and time-limited secure sharing links.
- Human approval for packages, editable AI drafts, manual replies, pause/resume, human handover, deal conversion and closing.
- Follow-up reminders with a configurable delay, due state, send, snooze, complete and history controls.
- Notifications for new inquiries, package approvals, due follow-ups and conversations requiring human review.
- Search and filters for brand/free text, influencer, lead status, campaign type, inquiry date and follow-up status; Agent Inbox also filters by conversation status.
- Role-based permissions, audit history, private file cleanup, responsive layouts, validation and error handling.
- Test inquiry creation/deletion for client demos without messaging a real customer.

## Provider-dependent items

Live WhatsApp and Instagram sending/reading works only after the relevant Meta app, verified business/account eligibility, permissions, webhook subscriptions and credentials are approved and configured. TikTok, Facebook and Gmail are account/profile connections in this scope; their direct-message inboxes are not claimed as live agent channels.

The dashboard adds no per-message charge. Meta/provider messaging fees, AI model usage, hosting, database and other third-party usage remain provider-billed costs.

## Required update step

After replacing an older project copy, preserve `.env.local`, then run:

```powershell
npm install
npm run db:setup
npm run dev
```

`db:setup` adds the new structured campaign columns without deleting existing records.
