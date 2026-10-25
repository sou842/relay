# Messaging gateway platform (personal test project)

Two parts:
- **Gateway**: self-hosted engine with a GREEN-API-compatible HTTP API.
- **Web**: a Next.js site with docs, accounts, instance management, and a chat UI.

WhatsApp is the first provider. Telegram (or anything else) plugs in later
without restructuring.

Ground rules: WhatsApp access goes through Baileys (no reverse engineering of
WhatsApp itself). Use test numbers, message people who expect it, keep a human
pace. The UI copies WhatsApp Web's layout and feel but uses our own name and
logo, not WhatsApp's trademarks.

## Architecture

```
browser ──► apps/web (Next.js 16)                      apps/gateway (Fastify)
            ├─ /docs           MDX setup guide         ├─ /{wa|tg}Instance{id}/{method}/{token}   GREEN-API compatible
            ├─ /sign-in, /sign-up  (Better Auth)        ├─ /admin/instances   create/delete (admin key)
            ├─ /app            dashboard                ├─ /admin/instances/{id}/events   SSE live feed
            ├─ /app/i/{id}     QR, credentials, settings└─ providers/
            ├─ /app/i/{id}/chat  WhatsApp-style chat         ├─ whatsapp (Baileys)
            └─ /api/i/{id}/…  proxy: session → ownership        └─ telegram (later, GramJS)
                               check → gateway with token
web DB (MongoDB): users, sessions, instances(owner, provider, gateway id, token)
gateway DB (MongoDB, own database): instances, notification queue, message journal, WhatsApp auth keys, media (GridFS)
```

Why proxy through Next.js: instance tokens stay server-side, every call is
checked against the signed-in user, and the browser has a single origin.

Provider seam (gateway): each provider supplies `createWorker()` plus a method
table. Instances carry `type`. The router picks the provider from the URL prefix
(`waInstance` / `tgInstance`). The web app treats `provider` as data, so the UI
loads provider-specific capabilities (QR vs. phone code, polls, reactions, …).

## Phases

### Done
- [x] Contract research with REA ([research/green-api-contract.md](research/green-api-contract.md))
- [x] Gateway core: instances, WhatsApp worker, send queue, notifications, webhooks, journal, uploads
- [x] Official SDK compat check (9/9 unauthenticated calls), self-send verified
- [x] Prototype UI at gateway `/ui` (removed once the web app replaced it)

### 1. Monorepo + gateway platform features ✅
- [x] npm workspaces: `apps/gateway`, `apps/web`
- [x] Provider registry (`providers/whatsapp`), `ChannelWorker` interface, shared `common-methods`
- [x] Admin API with `GATEWAY_ADMIN_KEY`: create / list / get / delete instances
- [x] SSE event stream per instance (`/{prefix}Instance{id}/events/{token}`), separate from the notification queue
- [x] Chat methods: editMessage, deleteMessage, forwardMessages, sendReaction*, readChat (whole chat),
  getContactInfo, getGroupData, subscribePresence*, unread counters, reactions + raw messages in journal
  (*our extensions, not in GREEN-API's SDK)
- [x] Official SDK regression: 13/13 (incl. real sends to self)

### 2. Web foundation ✅
- [x] Next.js 16.4 App Router (Cache Components off), Tailwind 4, lucide, sonner
- [x] Better Auth (email + password) on MongoDB Atlas; `proxy.ts` optimistic guard + per-route session checks
- [x] Landing page; MDX docs: overview, getting started, linking, chat, HTTP API, webhooks, self-hosting, safety
- [x] Dashboard: list/create/import/delete instances, QR + phone-code linking, live state,
  API credentials (reveal, copy, rotate), settings form, danger zone
- [x] Ownership-checked proxies: methods (JSON + multipart), SSE feed, media
- [x] Verified: cross-account isolation (404/409), blocked methods, unauthenticated 401

### 3. Chat UI (WhatsApp Web look) — first version ✅, needs hands-on testing
- [x] Chat list (search, All / Unread / Groups, unread badges, ticks, typing), conversation, info panel
- [x] Bubbles with tails, ticks, day separators, wallpaper, load-older on scroll, jump-to-latest with counter
- [x] Composer: emoji picker, attachments (photo/video, document, contact, poll, location), file preview + caption,
  voice-note recording, drag & drop, paste image, per-chat drafts
- [x] Message actions: reply, react, edit (15 min), delete for everyone, forward (up to 5 chats), copy, download; lightbox
- [x] Live updates over SSE, typing/online, auto mark-as-read, reconnect catch-up
- [x] Light + dark theme, phone layout (screenshots checked, no console errors)
- [ ] Hands-on test of every send/action path from the UI with real contacts
- [ ] Touch: long-press menu on phones (desktop hover menu only today)
- [ ] Voice notes from Chrome/Edge record WebM → sent as audio file, not a push-to-talk note (Firefox records Ogg → proper voice note); add server-side transcoding (ffmpeg) later

### 4. Hardening
- Rate limits on the proxy, audit of ownership checks, error states, empty states
- Docker compose (gateway + web), Cloudflare Tunnel guide

### 5. Telegram provider
- GramJS worker: QR login, phone code, 2FA password; same journal/queue/SSE machinery
- `tgInstance` routes; web picks the provider on "New instance"
