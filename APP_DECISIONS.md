# APP_DECISIONS.md

## Store Concept: Verdant Leaf — Artisan Tea Store

**Verdant Leaf** is a premium artisan loose-leaf tea e-commerce store that sources single-origin teas from small farms across the world's finest growing regions — Japan, China, India, Taiwan, Sri Lanka, and Kenya.

### Why Tea?
- **Visual richness**: Tea lends itself to stunning photography, earthy palettes, and elegant typography — ideal for demonstrating theme craftsmanship
- **Natural batching**: Tea has seasonal harvests (spring flush, autumn flush), making batch tracking an organic fit
- **Product depth**: Each tea has metadata (origin, altitude, steep time, temperature) that showcases custom section design
- **Storytelling**: Terroir, tradition, and craft provide rich branding opportunities

### Theme Design Decisions
- **Color Palette**: Deep forest green (#1a3c2a) + warm gold (#c8a45c) + cream (#faf6f0) — conveys earthiness and premium quality
- **Typography**: Native serif headings + system sans body text — classic elegance meets modern readability without remote font assets
- **Standout Feature — "Find Your Tea"**: A multi-step guided finder with **weighted scoring logic** across 6 tea categories. Each answer carries category scores that accumulate; the top 3 matches are shown with match percentages and link to the live catalog. This is more than a UI trick — it's a recommendation engine built with vanilla JS
- **3 Custom Sections**: Hero Parallax (CSS-driven depth), Interactive Origin Map (SVG with JS-driven pin interactions), Brewing Guide (step cards with scroll animations)

---

## App Idea: FreshTrack — Batch Freshness Intelligence

### The Problem
Shopify has **zero native support** for expiration dates, batch/lot tracking, or FEFO (First-Expired, First-Out) logic. Merchants selling perishable or shelf-life-sensitive products (tea, coffee, food, supplements, cosmetics) resort to:
- Spreadsheets for tracking batches → error-prone, no automation
- Expensive ERPs → overkill for small-to-mid merchants
- Metafields workarounds → no alerts, no FEFO, no analytics

This is a **documented, widely-complained-about gap** in the Shopify ecosystem (confirmed via Shopify Community forums and merchant subreddits).

### The Solution
FreshTrack provides **automated batch freshness monitoring** with:
1. **Freshness Score**: A time-decaying metric (0-100) that updates daily without user action
2. **Alert Rules**: Configurable threshold-action pairs (e.g., "when score < 30, apply 20% discount")
3. **Activity Log**: Full audit trail of every score change, alert trigger, and automated action
4. **Waste Analytics**: Track waste rate, at-risk batches, and revenue saved from timely discounting

### Why This Is "Not Just CRUD"
- The **Freshness Score** is a **computed, time-decaying metric** — `(days_remaining / total_shelf_life) × 100`. It changes every day without user action
- **Alert rules create an event-driven automation pipeline**: score change → threshold evaluation → action dispatch (discount/email/webhook). Rules only trigger when a score *crosses* below a threshold, not repeatedly
- The **Dashboard aggregates cross-batch analytics** with distribution visualization and waste rate calculations
- It ties directly to **quantifiable ROI**: "You saved $X by discounting 12 batches before expiry"

---

## Key Architecture & Schema Decisions

### Database: 5 Related Tables

```
stores (1) ──→ (N) products (1) ──→ (N) batches
stores (1) ──→ (N) alert_rules
stores (1) ──→ (N) activity_logs ←── batches
```

**Why 5 tables?**
- `stores`: Multi-tenant by design — supports multiple Shopify installations
- `products`: Links Shopify product IDs to internal tracking; stores `default_shelf_life_days` per product category
- `batches`: The core entity — each row represents a physical lot with manufacture/expiry dates, live freshness score, and status
- `alert_rules`: Decoupled from batches — rules are store-wide policies evaluated against any batch that crosses a threshold
- `activity_logs`: Append-only audit trail with JSON metadata — enables full traceability for compliance

**Why MySQL?** Requirement specified MySQL. Schema uses proper indexes on foreign keys, status, expiry date, and created_at for query performance.

### Backend Architecture
- **Express.js** with modular route files (auth, batches, alerts, dashboard, logs, products)
- **Freshness Engine** (`services/freshness.js`): Pure business logic separated from routes — calculates scores, evaluates rules, logs activity
- **Validation layer** (`utils/validation.js`): Shared helpers enforce enums (action types, categories), numeric ranges (alert thresholds 1–99), and date ordering (`expiresAt > manufacturedAt`) before anything reaches the database. A `respondWithError` helper maps `ValidationError` → 400 and everything else → a logged 500, so route handlers stay thin and consistent. Update/delete routes return 404 for unknown IDs.
- **JSON columns** are written as plain objects and Drizzle handles serialization (no manual `JSON.stringify`), avoiding the double-encoding that strings into a `json` column would cause
- **Dashboard endpoint** performs score recalculation on every read — ensures data is always current without requiring a cron job
- **Shopify OAuth** follows the official embedded-app flow: HMAC verification → code exchange → token storage in `stores`. **This is the only supported auth path** — demo seed tokens are rejected until OAuth completes. On install, the app syncs the product catalog and registers product webhooks when `HOST` is public
- **Embedded launch flow** (`routes/embedded.js`): `/app` validates the shop, checks installation, redirects to OAuth if needed, then launches the Vite frontend with `shop`, `host`, and `embedded=1`. The server also emits `frame-ancestors` CSP headers so Shopify Admin can iframe the app.
- **Security — session tokens + encrypted tokens at rest**: Every `/api/*` data route is guarded by middleware (`utils/sessionAuth.js`) that verifies the App Bridge **session token** (JWT, HS256) on each request using the app secret — checking signature, `exp`/`nbf`, and `aud` — then scopes the request to the token's shop (`req.storeId`). By-id reads/writes are ownership-checked to prevent cross-store access (IDOR). OAuth **access tokens are encrypted with AES-256-GCM** (`utils/crypto.js`) before being written to the `stores` table and decrypted only for Admin API calls. A non-production fallback accepts `?storeId`/`?shop` so the app still runs locally without a Shopify tunnel.
- **Single-service in production**: when `frontend/dist` is built, Express serves it (static + SPA fallback) alongside the API, so the whole app runs behind one HTTPS origin. In development the Vite dev server handles the frontend and proxies `/api`, `/auth`, `/app` to the backend.
- **Product & batch sync** (`services/productSync.js` + `services/shopify.js`): Shopify owns the product catalog and inventory; FreshTrack mirrors both via Admin API (`POST /api/products/sync`) and `products/*` webhooks. Each product is mirrored as **one auto-created tracking batch**: **quantity comes from live Shopify inventory**, and **expiry is seeded from the category's default shelf life** on first create. Because Shopify has no field for expiry/lot/supplier, that one piece of data is **merchant-editable** (Edit a batch) and is then preserved across syncs while stock keeps updating from Shopify. This keeps the table fully catalog-driven (add a product in Shopify → it appears here automatically) without pretending Shopify stores data it doesn't.

### Frontend Architecture
- **Vite + React** with React Router for SPA navigation
- **Shopify App Bridge** initializes when Shopify Admin provides `shop` and `host` query params; sidebar navigation preserves those params so embedded context survives page transitions
- **No external UI library** — custom CSS design system inspired by Shopify Polaris but tailored for FreshTrack's brand
- **Single API client** (`src/api.js`) — one fetch wrapper that throws readable errors; components surface failures via a lightweight toast system and render graceful empty states instead of failing silently
- **Shared presentation helpers** — `utils/format.js` (score colors, relative time, category labels) and `utils/activityMeta.jsx` (action icon/label map) remove duplication across the dashboard, batch, and activity views
- **Sidebar layout** mimicking Shopify Admin's embedded app pattern

### Freshness Score Algorithm
```
score = (days_remaining / total_shelf_life) × 100

Status thresholds:
  ≥ 60  → "active"   (green)
  ≥ 30  → "warning"  (amber)
  > 0   → "critical" (red)
  ≤ 0   → "expired"  (grey)
```

The score is recalculated:
1. On every batch read (API accuracy)
2. On dashboard load (triggers bulk recalculation)
3. On batch create/update (immediate score)

### Alert Rule Evaluation
- Alerts fire **only when a score crosses below the threshold** (oldScore > threshold && newScore <= threshold)
- This prevents repeated firing for already-low batches
- Supports three action types: auto-discount, email notification, webhook

---

## Tradeoffs

| Decision | Tradeoff | Rationale |
|----------|----------|-----------|
| **Recalculate on read** vs. cron job | Slightly slower API response | Guarantees data freshness without infrastructure setup; a production version would use both |
| **Toast + empty states** vs. mock data fallback | No fake rows when offline | Failures are surfaced honestly (toast) and the UI degrades gracefully, which is closer to production behavior than silently injecting fake data |
| **No actual Shopify API calls** for discounts | Alert actions are logged but not executed | Would require a real Shopify store; the architecture supports it with the `actionConfig` JSON field |
| **Session-token auth with a dev fallback** | Local non-embedded runs rely on a `?storeId` query param when `APP_ENV !== production` | Production enforces verified App Bridge session tokens on every API call; the dev fallback keeps the app runnable without a tunnel for quick review |
| **Single-file CSS** vs. CSS modules | Larger CSS file | Simpler to review; no build tool configuration needed for CSS |
| **Vanilla JS for theme** | Less structure | Requirement specified "minimal JavaScript"; quiz logic is well-encapsulated in a single IIFE |
| **MySQL over PostgreSQL** | Enum types are less flexible | Requirement explicitly specified MySQL |

---

## What I'd Improve With More Time

1. **Real Shopify Admin API integration**: Sync products via webhook, apply actual price rules for auto-discounting, display freshness on storefront via metafields
2. **Cron-based score recalculation**: Background job to update scores every 6 hours with batch notifications
3. **Charts & trend visualization**: Line chart for freshness score trends over time (per batch and store-wide), waste rate month-over-month comparison
4. **FEFO order routing**: When an order comes in, suggest shipping the batch with the lowest freshness score first
5. **Supplier performance analytics**: Track which suppliers' batches have the best/worst freshness retention
6. **Bulk batch import**: CSV upload for merchants migrating from spreadsheets
7. **Mobile-responsive app UI**: Fully optimized for mobile admin access
8. **E2E test suite**: Cypress tests for the quiz flow and Playwright tests for the app
9. **Order-driven FEFO**: Listen for `orders/create` webhooks to auto-decrement the lowest-freshness batch on real sales
10. **Secrets management**: Move `TOKEN_ENCRYPTION_KEY` into a managed secrets store (e.g. AWS Secrets Manager) with key rotation
