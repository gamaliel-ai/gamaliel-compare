# gamaliel-compare

**Building in public.** This is early development and may go away at any time.

Next.js app that talks to the [Gamaliel Public API](https://developer.gamaliel.ai/llms.txt) with the hosted key (no `Authorization` header). Hosted access is capped at 3 requests per minute per IP.

- Base URL: `https://api.gamaliel.ai/v1`
- Chat: `POST /v1/chat/completions`
- Scripture search: `GET /v1/scripture/search`

## Setup

```bash
nvm use
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
