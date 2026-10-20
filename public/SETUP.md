# Inspirers’ Den — Next.js + Supabase

## Requirements and first run

Node.js 24, npm, and a Supabase project. Open the extracted `inspirers-den` folder in VS Code, the directory that contains `package.json`. Existing `.env.local` and `.data` must be kept when updating a previous copy.

```powershell
npm install
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Edit `.env.local` locally. The required values are:

- `APP_URL=http://localhost:3000`
- `SUPABASE_URL` — Project URL in Supabase.
- `SUPABASE_ANON_KEY` — Publishable/anon key from the same project, used for login.
- `AGENCY_OWNER_EMAIL` — Your verified account email, before its first sign-in.
- `DATABASE_URL` — Supabase Dashboard **Connect → Session pooler** URI. Replace `[YOUR-PASSWORD]` with the database password. Percent-encode special characters such as `@`, `#`, `?`, and `&` in that password. On an IPv4-only Windows network, use the Session pooler instead of the direct IPv6 URI.
- `SUPABASE_SERVICE_ROLE_KEY` — Server-only secret from Supabase Project Settings → API Keys. Never put it in `NEXT_PUBLIC_*`, client code, GitHub, a screenshot, or chat. It is used only by the permission-checked API for private uploads.

`DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are different from the anon key. The anon key alone does not create database tables or let this server store private files.

With the server stopped, initialize tables and a private bucket:

```powershell
npm run db:setup
```

The setup script is safe to rerun. It executes `supabase/schema.sql` and creates the private `agency-private` Storage bucket, unless `SUPABASE_STORAGE_BUCKET` sets another bucket name. The application tables have RLS enabled and no direct `anon`/`authenticated` grants. The Node server uses the private Postgres connection and enforces record permissions; browser clients never query these tables directly.

If you have records and uploads in your earlier `.data/agency.sqlite`, copy that entire `.data` folder into this project and run this **once before opening the new dashboard**:

```powershell
npm run db:migrate-local
```

Migration requires a fresh Supabase workspace. It copies all ten application tables and uploaded files, preserves IDs and audit history, and leaves the local `.data` untouched as a backup. If your previous project had no saved data, skip this command; the owner’s first dashboard visit seeds the supplied sample creator portfolios and packages. The private Sites preview is a separate database and is not imported by this script.

Start the app:

```powershell
npm run dev
```

Open `http://localhost:3000`. For production mode, stop the dev server, then run `npm run build` and `npm run start`. Update `APP_URL` and Supabase Auth redirect URLs to your HTTPS domain before live deployment. Next.js and npm run inside the project; no global pnpm or Vite commands are needed.

If PowerShell blocks `npm.ps1`, run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` once, accept the prompt, and reopen VS Code. Alternatively use Command Prompt for the same npm commands.

## Login

In Supabase Auth URL Configuration, use your `APP_URL` as Site URL and add `<APP_URL>/auth/verify` and `<APP_URL>/auth/reset` as exact redirect URLs. Enable email/password and email confirmation. Sign up at `/auth/signup` with the `AGENCY_OWNER_EMAIL`, click the verification email, and sign in at `/auth/login`. The first verified owner email gets Agency Owner access. Other accounts start as restricted Influencers and need an agency invitation. For external recipients, configure custom SMTP; default Supabase mail is limited to project team addresses.

## Delete an influencer

Open the profile from Dashboard → Influencers. Agency Owner or Admin sees **Delete influencer**. Type the exact name to confirm. If any social account is connected, disconnect it first. Deletion removes that profile, its clicks, pending invitations, connections, uploaded files and access to its portal account. Existing lead and campaign records stay, with the deleted influencer reference removed. The public roster reads current database records, so the profile disappears there too. The audit log keeps a deletion entry. Archive remains an alternative for a temporary hide.

## Deployment and data

Application records live in Supabase Postgres; private uploaded bytes live in a private Supabase Storage bucket. All writes go through authenticated or validated server routes. This version no longer requires a persistent local disk. Do not upload `.env.local`, `.data`, `.next` or `node_modules` to GitHub. GitHub Desktop/Git respect `.gitignore`; browser uploads require manually excluding these paths.

A Node.js 24 host can run `npm ci`, `npm run build`, then `npm run start`. Add all required environment variables in the host settings, and configure your deployed origin in Supabase Auth. For a serverless Next.js host, choose Supabase's transaction pooler connection string. Use a separate `APP_URL` for each environment and include its verification/recovery redirects in Supabase.

## OAuth security and shared configuration

Set `APP_URL` to the exact HTTPS origin. Generate a random 32-byte key and base64-encode it for `TOKEN_ENCRYPTION_KEY`, e.g. `openssl rand -base64 32`. Keep the key and provider secrets in server secret settings. Rotation requires re-encrypting existing connection tokens; do not simply overwrite a key used by active connections.

Start routes require an authenticated user authorized to edit the relevant influencer. Authorization uses a random 10-minute state bound to the user, platform, influencer and an HTTP-only cookie. The callback consumes the state once. Account tokens are encrypted; API responses never include tokens. Disconnect revokes access with the provider before clearing the local token. On expired connections, reconnect through official consent.

The completed agent backend supports official WhatsApp Cloud API and Instagram Messaging webhooks, conversation history, lead capture, manual takeover and admin-approved package sending. Gmail, TikTok and Facebook remain profile connections; their inboxes are not read. See `HANDOVER.md` and `.env.example` for activation.

### Meta: Instagram and Facebook

Set `META_APP_ID`, `META_APP_SECRET`, and `META_GRAPH_VERSION` to a supported version such as the version selected in your Meta application dashboard. No version is guessed in code.

Register:
- `APP_URL/api/oauth/instagram/callback`
- `APP_URL/api/oauth/facebook/callback`

Facebook uses `public_profile`. Instagram through Facebook Login uses `pages_show_list`, `pages_read_engagement`, `instagram_basic` and `instagram_manage_messages`. Complete Meta app review and any applicable business verification before onboarding people outside the app's approved test roles. Instagram accounts must be Business/Creator accounts linked to a Facebook Page. The adapter requires exactly one linked professional account; otherwise it returns a clear permission/account-selection error.

Documentation: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/ . Confirm current permissions, messaging access and webhook requirements in the app dashboard before enabling production connections.

### TikTok

Set `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`. Configure official Login Kit with approved `user.info.basic` and `user.info.profile` scopes. Register `APP_URL/api/oauth/tiktok/callback` as an exact HTTPS redirect URI and complete app review.

Authorization: `https://www.tiktok.com/v2/auth/authorize/`. Token exchange: `https://open.tiktokapis.com/v2/oauth/token/`. The callback reads the authorized display name/avatar and encrypts the issued tokens. No TikTok direct-message support is claimed.

Documentation: https://developers.tiktok.com/doc/login-kit-web and https://developers.tiktok.com/doc/oauth-user-access-token-management .

### Google / Gmail identity

Create a Google Cloud Web OAuth client. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Configure the consent screen, test users where applicable and register `APP_URL/api/oauth/gmail/callback`.

Scopes are `openid email profile`; this connects Google/Gmail account identity only. No Gmail API mailbox permissions are requested in this phase. An account connection does not imply inbox access. If a future phase needs Gmail data, request the minimum relevant Gmail scopes, enable the API, complete the applicable verification and re-consent users.

Documentation: https://developers.google.com/identity/protocols/oauth2/web-server and https://developers.google.com/workspace/gmail/api/auth/scopes .

## Product notes

- New influencer profiles require an email and automatically generate a secure portal invitation. Staff can regenerate invitations. Links are shared manually, not emailed automatically.
- Creators without a recorded email must have an email added before a valid invitation can be created.
- Conversion rate = confirmed leads / recorded leads for the selected creator or date range. Clicks are redirect events, not unique visitors; bots and repeat clicks can count.
- Calendar view is a date-sorted campaign agenda. A month-grid scheduler and recurring sync are not included.
- Testimonials and agency campaign case studies remain editable content placeholders until approved material is supplied.
- Browser WebMCP exposes a feature-detected influencer search tool only. It does not create an AI chatbot or automated agent.

