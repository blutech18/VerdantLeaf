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
- **Standout Feature — Tea Quiz**: A multi-step quiz with **weighted scoring logic** across 6 tea categories. Each answer carries category scores that accumulate; the top 3 matches are shown with match percentages. This is more than a UI trick — it's a recommendation engine built with vanilla JS
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
- **Dashboard endpoint** performs score recalculation on every read — ensures data is always current without requiring a cron job
- **Shopify OAuth** follows the official flow: HMAC verification → code exchange → token storage
- **Embedded launch flow** (`routes/embedded.js`): `/app` validates the shop, checks installation, redirects to OAuth if needed, then launches the Vite frontend with `shop`, `host`, and `embedded=1`. The server also emits `frame-ancestors` CSP headers so Shopify Admin can iframe the app.

### Frontend Architecture
- **Vite + React** with React Router for SPA navigation
- **Shopify App Bridge** initializes when Shopify Admin provides `shop` and `host` query params; sidebar navigation preserves those params so embedded context survives page transitions
- **No external UI library** — custom CSS design system inspired by Shopify Polaris but tailored for FreshTrack's brand
- **Mock data fallback** — all components render with realistic demo data when the API is unavailable, making the UI reviewable without a running backend
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
| **Mock data fallback** in frontend | Extra code in components | Enables UI review without backend; critical for a take-home evaluation |
| **No actual Shopify API calls** for discounts | Alert actions are logged but not executed | Would require a real Shopify store; the architecture supports it with the `actionConfig` JSON field |
| **App Bridge without session-token API auth** | Embedded shell initializes, but API auth remains demo-oriented | Keeps the take-home runnable locally while showing where production session token verification would plug in |
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
9. **Session token authentication**: Verify Shopify App Bridge session tokens on API routes for production embedded apps
10. **Webhook receivers**: Listen for `products/update` and `orders/create` Shopify webhooks to auto-sync data
