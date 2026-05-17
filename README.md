# Crawli — Resale Price Aggregator

Find the best resale prices across multiple marketplaces in one search. Crawli aggregates live pricing from Grailed, Depop, StockX, Poshmark, Mercari, Vinted, eBay, and Vestiaire.

## Features

- **Multi-marketplace search** — Search once, see prices across 8 resale platforms
- **Live pricing** — Real-time price data from each marketplace
- **User authentication** — Sign up with email/password or Google OAuth
- **Protected search** — Authentication required to access search functionality
- **Dark/light theme** — Theme toggle for comfortable browsing
- **Responsive design** — Works on desktop and mobile

## Tech Stack

- **Frontend:** Next.js 16.2.6 (App Router) + React 19 + Tailwind CSS v4 + TypeScript
- **Backend:** Python sidecar (crawl4ai + Playwright) for scraping
- **Search:** Firecrawl for marketplace discovery
- **Auth:** Supabase Auth (email + password, Google OAuth)
- **Database:** Supabase Postgres for user profiles

## Development

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+ (for the sidecar crawler)

### Setup

1. Clone the repo:
```bash
git clone <repo-url>
cd fashion-crawler-crawl4ai
npm install
```

2. Create `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

3. Start the dev server (both Next.js and Python sidecar):
```bash
npm run dev:all
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Commands

- `npm run dev:all` — Start Next.js (port 3000) + Python sidecar (port 8000) together
- `npm run dev` — Start Next.js only (port 3000)
- `npm run dev:sidecar` — Start Python sidecar only (port 8000)
- `npm run build` — Build for production
- `npm run lint` — Run TypeScript type check

## Project Structure

```
app/
├── (protected)/          # Routes requiring authentication
│   └── page.tsx          # Search page
├── auth/                 # Auth routes (callback, reset-password)
├── login/                # Login/signup page
├── components/           # React components
└── api/                  # API routes (search endpoint)
lib/
├── supabase/            # Supabase client setup
├── hooks/               # Custom React hooks
└── types.ts             # TypeScript types
crawl4ai-service/        # Python sidecar for scraping
public/                  # Static assets
```

## Authentication

- **Email/Password:** Standard sign up and sign in
- **Forgot Password:** Reset password flow via email link
- **Google OAuth:** One-click sign up/in with Google
- **Protected Routes:** Pages in `app/(protected)/` require authentication

## Known Issues & Gotchas

- **Vestiaire URL discovery broken** — Search works, but URL-finding is blocked. Scraping works fine.
- **Email quota low** — Supabase free tier: 4 emails/hour. Configure custom SMTP if needed.
- **eBay may have issues** — Known quirks with result matching.

## Contributing

See [CLAUDE.md](CLAUDE.md) for development guidelines and [HANDOFF.md](HANDOFF.md) for project status.

## License

MIT
