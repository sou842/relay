# Relay — Web

The web app for **Relay**, a self-hosted messaging gateway. It provides the landing page, documentation, user accounts, an instance dashboard, and a WhatsApp Web–style chat UI. All messaging goes through the [Relay gateway](../gateway), which this app talks to server-side.

## Features

- **Accounts** — email and password sign-up and sign-in (Better Auth, sessions stored in MongoDB).
- **Dashboard** (`/app`) — create, import and delete instances, with live status for each one.
- **Instance page** (`/app/i/[id]`):
  - link a phone with a QR code or a pairing code
  - API credentials with token rotation
  - webhook and notification settings
  - session controls and delete
- **Chat** (`/app/i/[id]/chat`) — a browser inbox:
  - replies, reactions, edits, deletes and forwards
  - media, voice notes, polls, locations and contacts
  - typing and online indicators, with live updates over SSE
- **Docs** (`/docs`) — MDX guides for getting started, linking, chat, the HTTP API, webhooks, self-hosting and safe use.
- **Settings** (`/app/settings`) — profile, password, appearance, chat preferences and gateway status.
- Light and dark themes, and layouts that work on phones.

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Styling | Tailwind CSS 4, lucide-react icons, sonner toasts |
| Auth | Better Auth (email + password) |
| Database | MongoDB (users, sessions, instance ownership) |
| Data fetching | SWR for client reads, plain `fetch` for writes |
| Content | MDX via `@next/mdx` + `remark-gfm` |
| Validation | Zod |

## How it fits together

```
Browser ──► Next.js (this app) ──► Relay gateway ──► WhatsApp (Baileys)
              │  checks session + ownership,
              │  adds the instance token server-side
              ▼
           MongoDB
```

The browser never sees instance tokens or the gateway admin key. Every gateway request goes through a same-origin route under `/api/instances/...`, which does three things:

1. checks the session
2. checks that the signed-in user owns the instance
3. forwards the call to the gateway with the token added

## Project structure

```
src/
├─ app/
│  ├─ (auth)/            sign-in, sign-up (split-screen layout)
│  ├─ app/               signed-in area: dashboard, instance page, chat, settings
│  ├─ api/
│  │  ├─ auth/           Better Auth handler
│  │  └─ instances/      ownership-checked proxies: methods, SSE events, media, credentials
│  ├─ docs/              MDX documentation pages
│  ├─ error.tsx, not-found.tsx, robots.ts
│  └─ page.tsx           landing page
├─ components/
│  ├─ app-shell.tsx      resizable, collapsible sidebar layout
│  ├─ dashboard/         instance list and instance detail
│  ├─ chat/              chat UI (list, conversation, composer, dialogs…)
│  ├─ settings/          account settings sections
│  ├─ landing/           landing page sections
│  └─ ui.tsx             shared primitives (Button, Input, Field, StatePill, Switch…)
├─ lib/
│  ├─ auth.ts            Better Auth server config + session helpers
│  ├─ db.ts              MongoDB client
│  ├─ gateway.ts         server-side gateway client
│  ├─ api.ts             route-handler helpers (errors, ownership checks)
│  ├─ client-api.ts      browser fetch helpers (api, callMethod)
│  ├─ swr.tsx            SWR provider + useApi / useMethod hooks
│  └─ use-instance-events.ts  live SSE feed hook
└─ proxy.ts              redirects requests without a session cookie away from /app
```

## Getting started

### Prerequisites

- Node.js 24 or newer
- A MongoDB database (MongoDB Atlas works)
- A running Relay gateway (see [apps/gateway](../gateway))

### Setup

From the repository root (this is an npm workspace):

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # then fill in the values
npm run gateway    # terminal 1: start the gateway
npm run web        # terminal 2: start this app on http://localhost:3000
```

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string |
| `MONGODB_DB` | no | Database name (default `sandbox`) |
| `BETTER_AUTH_SECRET` | yes in production | Random secret: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | yes in production | Public URL of this site, no trailing slash |
| `GATEWAY_URL` | yes in production | Gateway base URL (default `http://127.0.0.1:7700`) |
| `GATEWAY_ADMIN_KEY` | yes in production | Must match the gateway's `GATEWAY_ADMIN_KEY` |

A production build fails on purpose if any of the required variables are missing.

## Scripts

Run these from `apps/web`, or from the root with `-w web`:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |

## Deploying to Vercel

1. Import the repository and set **Root Directory** to `apps/web`. Keep "Include source files outside of the Root Directory" enabled so the workspace installs from the repo root.
2. Add the environment variables above for Production (and Preview, if you use it). Preview URLs are trusted for sign-in automatically.
3. In MongoDB Atlas → **Network Access**, allow connections from Vercel. Vercel has no fixed IPs, so this means `0.0.0.0/0` unless you use Vercel's static IP option.
4. Deploy.

### The gateway must be public

Vercel cannot reach `localhost`. Run the gateway on a machine that stays on, and expose it over HTTPS, for example with a Cloudflare Tunnel. Put that URL in `GATEWAY_URL`. Use a long random `GATEWAY_ADMIN_KEY`, because it is the only thing protecting the gateway's `/admin` routes.

### Platform limits

- **4.5 MB request bodies.** Vercel Functions reject larger uploads, so files bigger than that can't be sent through the chat.
- **Live feed.** Each SSE connection runs for at most 5 minutes, then the browser reconnects automatically and catches up.
- **Rate limits.** Auth rate-limit counters are stored in MongoDB so they hold across serverless instances.

## Security notes

- Every page and API route re-checks the session. `proxy.ts` is only a fast redirect for requests without a session cookie.
- Instance access is scoped to the owner. Other users' instances return 404.
- Response headers include HSTS, `X-Frame-Options: DENY`, `nosniff`, a referrer policy and a permissions policy that allows the microphone for voice notes.
- `.env*` files are git-ignored. Only `.env.example` is committed.

## Responsible use

Relay connects through Baileys as a linked device. Use test numbers, message only people who expect it, and keep a human sending pace. See `/docs/safety`. The UI copies WhatsApp Web's layout but uses Relay's own name and logo.
