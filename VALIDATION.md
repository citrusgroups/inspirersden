# Validation

- `npm run lint`, `npm run typecheck`, and `npm test`: passed after Supabase conversion. The test exercises PostgreSQL schema, RLS, and influencer relation cleanup locally using PGlite.
- `next build --webpack`: passed, including compiled routes, TypeScript and static page generation. The `npm run build` script uses this verified build mode.
- Live Supabase credentials were not supplied. Run `npm run db:setup`, optional `npm run db:migrate-local`, and verify an owner sign-in, private upload and delete against your own project before deployment.
- Existing local `.data` is left untouched; moving files without `db:migrate-local` does not copy their database rows to Supabase.
- Agency-level Instagram, Facebook, TikTok and Gmail identity connections are separated from influencer connections. Only an Agency Owner/Admin can authorize or disconnect company accounts; the same official OAuth and encrypted-token flow is used for both levels.
- Automated replies, inbox reading and AI-agent behavior remain intentionally excluded from this dashboard phase.
