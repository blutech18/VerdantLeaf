# Verdant Leaf + FreshTrack

A custom Shopify theme for an artisan tea store, paired with an embedded Shopify app for batch freshness intelligence.

---

## Project Structure

```
TakeHomeTask/
├── theme/              # Part 1: Shopify Theme (Liquid + CSS + JS)
│   ├── assets/         # CSS design system, section styles, quiz styles + JS
│   ├── config/         # Theme settings schema
│   ├── layout/         # Main theme.liquid layout
│   ├── locales/        # English translations
│   ├── sections/       # 7 sections (header, footer, hero, origin-map, brewing-guide, tea-quiz, etc.)
│   ├── snippets/       # Reusable components (product-card, price)
│   └── templates/      # Page templates (index, collection, product, cart)
│
├── app/                # Part 2: Embedded Shopify App
│   ├── frontend/       # Vite + React SPA
│   │   └── src/
│   │       ├── components/  # Dashboard, BatchManager, AlertRules, ActivityLog
│   │       ├── App.jsx      # Router + sidebar layout
│   │       └── index.css    # App design system
│   ├── server/         # Node.js + Express API
│   │   ├── db/         # Drizzle ORM schema, migrations, connection
│   │   ├── routes/     # REST API routes (auth, batches, alerts, dashboard, logs)
│   │   └── services/   # Freshness scoring engine
│   └── drizzle.config.js
│
├── APP_DECISIONS.md    # Architecture decisions document
└── README.md           # This file
```

---

## Part 1: Theme Setup

### Prerequisites
- [Shopify CLI](https://shopify.dev/docs/themes/tools/cli) installed
- A Shopify development store

### Deploy to Shopify
```bash
cd theme
shopify theme push --store verdantleafshop.myshopify.com
```

### Local Development
```bash
cd theme
shopify theme dev --store verdantleafshop.myshopify.com
```

### Theme Features
- **Core Pages**: Home, Collection, Product, Cart
- **3 Custom Sections**: Hero Parallax, Tea Origin Map (interactive SVG), Brewing Guide
- **Standout Feature**: "Find Your Tea" — a 4-question guided finder with a weighted scoring algorithm that recommends teas from the live catalog
- **Design**: Shopify-safe native serif + system sans typography, earth-tone palette, scroll animations, parallax effects
- **Accessibility**: Keyboard-revealed skip link, mobile nav with `aria-expanded` + Escape-to-close + scroll lock, valid (non-nested) interactive markup on product cards
- **FreshTrack tracker**: Add-to-cart events are forwarded to the embedded app via a configurable endpoint (Theme settings → FreshTrack Integration); blank endpoint disables tracking

---

## Part 2: App Setup

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- A Shopify Partner account (for app credentials)

### 1. Configure Environment
```bash
cd app
cp .env.example .env  # Edit with your DB credentials
```

Edit `.env` with your values:
```env
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
VITE_SHOPIFY_API_KEY=your_api_key
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=freshtrack

# Encrypts OAuth access tokens at rest (AES-256-GCM). Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Falls back to SHOPIFY_API_SECRET if unset.
TOKEN_ENCRYPTION_KEY=

# development = run locally without a tunnel (demo store, ?storeId fallback)
# production  = require a verified Shopify session token on every API call
# (APP_ENV is used instead of NODE_ENV so Vite doesn't warn during frontend build)
APP_ENV=development
```

### 2. Set Up Database
```bash
# Create MySQL database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS freshtrack;"

# Run migrations (and optional offline demo data for a no-OAuth preview)
cd app/server
npm install
npm run migrate
npm run seed       # optional: sample data for local preview without OAuth

# To clear batches/logs/alerts and repopulate from real Shopify data on next sync:
#   npm run reset
```

### 3. Install Dependencies & Start
```bash
# Backend
cd app/server
npm run dev       # Starts on port 3000

# Frontend (separate terminal)
cd app/frontend
npm install
npm run dev       # Starts on port 5173
```

### 4. Install via OAuth (required)

FreshTrack uses **Shopify OAuth + embedded app flow** — the canonical path for this take-home.

#### Step 1 — Partner app settings

Create an app in [Shopify Partners](https://partners.shopify.com) and configure:

| Setting | Value |
|---|---|
| App URL | `http://localhost:3000/app` |
| Allowed redirection URL | `http://localhost:3000/auth/callback` |
| Scopes | `read_products`, `write_products`, `read_inventory` |

Copy `Client ID` → `SHOPIFY_API_KEY` and `Client secret` → `SHOPIFY_API_SECRET` in `app/.env` (and `VITE_SHOPIFY_API_KEY`).

#### Step 2 — Start servers

```bash
# Terminal 1 — backend
cd app/server && npm run dev

# Terminal 2 — frontend
cd app/frontend && npm run dev
```

#### Step 3 — Install the app

> **Important:** Shopify **blocks `localhost` inside the admin iframe** (`ERR_BLOCKED_BY_CSP`). For embedded mode you need a public HTTPS tunnel (ngrok). See **"Embedded app: ngrok setup"** below.

Open this URL in your browser:

```
http://localhost:3000/auth?shop=verdantleafshop.myshopify.com
```

(After ngrok setup, use your `https://....ngrok-free.app/auth?shop=...` URL instead.)

1. Approve permissions on Shopify
2. OAuth stores a real `access_token` in the `stores` table
3. Product catalog syncs automatically
4. You land in the embedded Vite frontend with `shop` + `host` params (App Bridge)

#### Embedded app: ngrok setup (fixes `LOCALHOST IS BLOCKED`)

Shopify Admin cannot iframe `localhost`. Use **one ngrok tunnel** to port **5173** (Vite proxies `/api`, `/auth`, `/app` to the backend).

1. Install ngrok: [https://ngrok.com/download](https://ngrok.com/download)
2. Start your servers (backend 3000 + frontend 5173)
3. In a new terminal:
   ```bash
   ngrok http 5173
   ```
4. Copy the **HTTPS** URL (e.g. `https://abc123.ngrok-free.app`)
5. Update `app/.env` — **both** use the same ngrok URL:
   ```env
   HOST=https://abc123.ngrok-free.app
   FRONTEND_URL=https://abc123.ngrok-free.app
   ```
6. Update **Shopify Partners** app settings:
   | Field | Value |
   |---|---|
   | App URL | `https://abc123.ngrok-free.app/app` |
   | Allowed redirection URL | `https://abc123.ngrok-free.app/auth/callback` |
7. **Restart** backend + frontend
8. Install via:
   ```
   https://abc123.ngrok-free.app/auth?shop=verdantleafshop.myshopify.com
   ```
9. Open the app from **Shopify Admin → Apps → VerdantLeaf** — it should load inside the admin without CSP errors.

#### Step 4 — Open from Shopify Admin (embedded demo)

After install, open the app from **Shopify Admin → Apps → FreshTrack**, or use:

```
http://localhost:3000/app?shop=verdantleafshop.myshopify.com
```

If the token is missing or still demo seed data, `/app` redirects back to OAuth automatically.

#### Demo checklist (for reviewers)

- [ ] OAuth install completes (`/auth?shop=...`)
- [ ] App opens embedded with App Bridge (`shop` + `host` in URL)
- [ ] **Batches** page auto-populates with one row per Shopify product (stock pulled from Shopify inventory)
- [ ] Add a product in Shopify admin → it appears here automatically (via webhook), or click **Sync from Shopify**
- [ ] **Edit** a batch to set the real expiry date / lot number (the data Shopify doesn't store)

#### Real-time product updates (optional — webhooks)

When `HOST` is public (e.g. ngrok `https://abc.ngrok.io` → port 3000), OAuth install registers `products/create|update|delete` webhooks. Set `SHOPIFY_FORCE_WEBHOOKS=true` if needed.

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health

### App Features
| Feature | Description |
|---------|-------------|
| **Dashboard** | Real-time metrics: avg freshness, waste rate, at-risk batches, freshness distribution bar |
| **Batch Management** | One batch per Shopify product, **auto-created from your catalog** with stock pulled from live Shopify inventory. Add a product in Shopify → it appears here automatically. Edit a row to set the real expiry date / lot number (data Shopify doesn't store). Live freshness score calculation |
| **Shopify Catalog Sync** | `POST /api/products/sync` pulls live products via Admin API; webhooks keep FreshTrack in sync when products change in Shopify admin |
| **Alert Rules** | Configurable threshold-action pairs (auto-discount, email, webhook). Event-driven evaluation |
| **Activity Log** | Full audit trail, filterable by action type, with server-side pagination |
| **Freshness Engine** | Time-decaying score algorithm: `(days_remaining / shelf_life) × 100` |

### Database Schema
5 related MySQL tables defined in Drizzle ORM and backed by `app/server/db/migrations/0000_initial_schema.sql`:
- `stores` — Shopify store installations
- `products` — Products with default shelf life
- `batches` — Inventory batches with freshness tracking
- `alert_rules` — Configurable threshold alerts
- `activity_logs` — Full audit trail

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Dashboard metrics + score recalculation |
| GET/POST | `/api/batches` | List/create batches |
| PUT/DELETE | `/api/batches/:id` | Update/delete batch |
| GET/POST | `/api/alerts` | List/create alert rules |
| PUT/DELETE | `/api/alerts/:id` | Update/delete rule |
| GET | `/api/logs` | Activity log with filters |
| GET | `/api/products` | List synced products |
| POST | `/api/products/sync` | Pull catalog from Shopify Admin API |
| POST | `/webhooks/products` | Shopify product create/update/delete webhook |
| GET | `/app` | Embedded Shopify Admin launch route |
| GET | `/api/install-status` | OAuth install state (real token vs demo seed) |
| GET | `/api/app-context` | Embedded app metadata |
| GET | `/auth` | Initiate Shopify OAuth |
| GET | `/auth/callback` | OAuth callback handler |

---

## Authentication & Security

- **Session-token auth**: every `/api/*` data route verifies the Shopify App Bridge session token (JWT) on each request and scopes the response to that shop. By-id operations are ownership-checked (no cross-store access).
- **Encrypted tokens at rest**: OAuth access tokens are AES-256-GCM encrypted before being stored, decrypted only for Admin API calls.
- **HMAC verification** on the OAuth callback and on incoming webhooks.
- **Local dev fallback**: when `APP_ENV` is not `production`, the API accepts a `?storeId`/`?shop` param so you can run and review without a Shopify tunnel.

## Running in Production (single-service)

In production, Express serves the built React app **and** the API from one origin — no separate Vite server needed.

```bash
cd app/server
npm run build      # builds frontend/dist
# set APP_ENV=production in app/.env
npm start          # serves API + frontend on port 3000
```

Point your tunnel/host at **port 3000** (not 5173) and set both `HOST` and `FRONTEND_URL` to that public HTTPS URL. Update the Partner dashboard App URL (`/app`) and redirect URL (`/auth/callback`) to match.

> **Tunnel tip:** Cloudflare *quick* tunnels (`*.trycloudflare.com`) generate a new hostname on every restart, which causes `ERR_NAME_NOT_RESOLVED` / "server IP address could not be found" and forces you to re-edit the dashboard each time. Use an **ngrok reserved domain** or a **named Cloudflare tunnel** for a stable URL, or deploy to a host (Render/Railway/Fly/VPS).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Theme | Shopify Liquid + CSS + Vanilla JS |
| Frontend | Vite 6 + React 18 + React Router 6 + Shopify App Bridge |
| Backend | Node.js + Express 4 |
| Database | MySQL 8 + Drizzle ORM |
| Auth | Shopify OAuth 2.0 |
