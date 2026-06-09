# Verdant Leaf + FreshTrack Interview Prep

## One-Minute Pitch

I built Verdant Leaf, an artisan tea Shopify storefront, and FreshTrack, an embedded Shopify admin app for batch freshness intelligence.

The storefront demonstrates Shopify Liquid, reusable sections, brand storytelling, product discovery, and a weighted tea recommendation quiz. The embedded app solves a real merchant workflow gap: Shopify does not natively support expiry dates, batch/lot tracking, freshness scoring, or FEFO-style inventory decisions for perishable products.

The two halves are intentionally connected. A premium tea merchant cares about harvests, suppliers, freshness, batches, and shelf life, so the admin app feels like a natural operational tool for the storefront.

## What The Take-Home Asked For

The assignment evaluated:

- Creativity
- Product thinking
- UI/UX
- Code quality
- Architecture

Theme requirements:

- Shopify Liquid, CSS, and minimal JavaScript
- Home, collection, product, and cart pages
- At least 3 custom sections/components
- 1 standout interactive feature

Embedded app requirements:

- Vite frontend
- Node.js backend
- Drizzle ORM
- Shopify OAuth and embedded app flow
- MySQL with multiple related tables
- Dashboard
- Create/update workflow
- History/activity tracking
- Logic-based feature such as scoring, alerts, or recommendations

## Project Summary

Store concept:

Verdant Leaf is a fictional premium loose-leaf tea shop selling single-origin teas from regions such as Japan, China, Taiwan, India, Egypt, and Sri Lanka.

App concept:

FreshTrack is a Shopify embedded admin app that helps merchants track physical inventory batches, expiry dates, freshness scores, alert rules, and activity history.

Main value proposition:

FreshTrack helps merchants identify aging inventory before it becomes waste, trigger discount/notification workflows, and maintain traceability by lot number.

## Demo Flow

1. Start with the Shopify theme homepage.
2. Show the brand concept and custom sections:
   - Hero parallax
   - Featured products
   - Tea origin map
   - Brewing guide
   - Tea quiz
   - Testimonials
   - Newsletter
3. Run through the tea quiz and explain weighted scoring.
4. Open a product page and show metadata, add-to-cart form, quantity selector, and product story.
5. Open collection and cart pages to show required core templates.
6. Switch to FreshTrack.
7. Show dashboard metrics: average shelf life, at-risk batches, waste rate, freshness distribution.
8. Show batch manager: create/update batch, expiry date, quantity sold, supplier, status.
9. Show alert rules: threshold-based email, discount, and webhook actions.
10. Show activity log: audit trail of batch changes, alerts, discounts, and rule changes.

## Architecture Overview

Theme:

- `theme/layout/theme.liquid` is the global shell.
- `theme/templates/index.liquid` assembles the homepage sections.
- `theme/templates/collection.liquid` renders product listing and client-side filters.
- `theme/templates/product.liquid` renders product details, metafields, quantity selector, and add-to-cart form.
- `theme/templates/cart.liquid` renders cart line items and quantity updates.
- `theme/sections/tea-quiz.liquid` defines the quiz screens and weighted answer data.
- `theme/assets/quiz.js` contains the quiz scoring engine.

App frontend:

- `app/frontend/src/App.jsx` defines the embedded-admin style shell and routes.
- `app/frontend/src/components/Dashboard.jsx` shows KPIs, freshness distribution, at-risk batches, and recent activity.
- `app/frontend/src/components/BatchManager.jsx` supports create/update workflows for batches.
- `app/frontend/src/components/AlertRules.jsx` manages threshold-based alert rules.
- `app/frontend/src/components/ActivityLog.jsx` shows the audit trail.
- `app/frontend/src/shopifyAppBridge.js` initializes Shopify App Bridge when `shop` and `host` are present.

App backend:

- `app/server/index.js` sets up Express, CORS, CSP, health check, and route modules.
- `app/server/routes/auth.js` handles Shopify OAuth.
- `app/server/routes/embedded.js` handles embedded app launch.
- `app/server/routes/batches.js` handles batch CRUD plus scoring on create/update/read.
- `app/server/routes/alerts.js` handles alert-rule CRUD.
- `app/server/routes/dashboard.js` aggregates dashboard metrics and triggers recalculation.
- `app/server/routes/logs.js` exposes filterable activity history.
- `app/server/services/freshness.js` contains the core business logic.

Database:

- `stores`
- `products`
- `batches`
- `alert_rules`
- `activity_logs`

Relationship model:

```text
stores (1) -> products (N) -> batches (N)
stores (1) -> alert_rules (N)
stores (1) -> activity_logs (N)
batches (1) -> activity_logs (N)
```

## Strongest Technical Talking Points

### 1. The App Is Not Just CRUD

FreshTrack has computed business behavior:

- Freshness score changes over time.
- Batch status changes automatically based on score.
- Alert rules trigger when a score crosses a threshold.
- Dashboard metrics aggregate across batches.
- Activity logs create an audit trail.

### 2. Business Logic Is Isolated

The freshness scoring and alert evaluation live in `app/server/services/freshness.js`, separate from Express route handlers. This makes the core logic easier to test, reason about, and reuse in a future cron job.

### 3. The Schema Is Multi-Tenant

The `stores` table owns products, alert rules, and activity logs. That prepares the app for multiple Shopify store installations instead of hard-coding a single store in the database model.

### 4. The Theme And App Tell One Product Story

The storefront sells tea, and tea is batch-sensitive. The admin app exists because the merchant needs to manage freshness, harvests, suppliers, and expiry windows.

### 5. The Frontend Is Reviewer-Friendly

The React app tries the API first and falls back to realistic mock data. This makes the UI reviewable even when MySQL or Shopify credentials are not configured.

## Freshness Algorithm

Formula:

```text
freshness_score = days_remaining / total_shelf_life * 100
```

The score is clamped between 0 and 100.

Status thresholds:

```text
>= 60  -> active
>= 30  -> warning
> 0    -> critical
<= 0   -> expired
sold quantity >= total quantity -> sold_out
```

Why this is useful:

It converts raw dates into a merchant-friendly operational signal. A merchant does not need to inspect every expiry date manually; they can scan statuses and alerts.

## Alert Rule Logic

Alert rules are threshold/action pairs.

Example:

```text
When freshness score falls below 15%, apply a discount or send an alert.
```

Important detail:

Rules only fire when a batch crosses below a threshold:

```text
oldScore > threshold && newScore <= threshold
```

This prevents the same rule from firing repeatedly on every dashboard refresh.

## Likely Interview Questions And Answers

### Q: Why did you choose tea?

A: Tea gave me a strong connection between storefront experience and admin operations. It is visual and brand-friendly for the theme, but it also has real batch/freshness concerns for the app: harvest dates, suppliers, shelf life, origin, and lot-level quality.

### Q: What problem does FreshTrack solve?

A: Shopify does not provide native batch-level expiry tracking or freshness logic. Merchants selling tea, coffee, food, supplements, or cosmetics often use spreadsheets or heavyweight ERPs. FreshTrack gives them batch tracking, freshness scoring, alert rules, and audit history inside the Shopify admin context.

### Q: What makes this app more than CRUD?

A: CRUD is only the data entry layer. The real feature is freshness intelligence. Scores decay over time, statuses update automatically, alert rules evaluate threshold crossings, and dashboard metrics summarize inventory risk.

### Q: Explain the database schema.

A: `stores` represents Shopify installations. `products` belong to stores and link to Shopify products. `batches` belong to products and represent physical lots. `alert_rules` belong to stores and define automation policies. `activity_logs` belong to stores and optionally batches, giving an audit trail.

### Q: Why use Drizzle ORM?

A: Drizzle keeps the schema explicit in code, gives typed/query-builder style access, and still maps cleanly to MySQL. For a take-home, it also makes the database model easy to review.

### Q: Why MySQL?

A: The task explicitly required MySQL. The schema uses relational constraints and indexes for store ownership, product ownership, status, expiry dates, and activity history.

### Q: Why recalculate freshness on dashboard read?

A: It guarantees the dashboard is current without requiring a background worker in the take-home environment. In production, I would add a scheduled job and keep read-time recalculation as a fallback or consistency check.

### Q: How would you scale recalculation?

A: I would add a scheduled worker that recalculates only active/non-sold-out batches, use indexes on status and expiry date, process batches in pages, and log only meaningful status or threshold changes.

### Q: How does Shopify OAuth work?

A: The app validates the shop domain, redirects to Shopify OAuth, stores a nonce in a cookie, verifies state and HMAC on callback, exchanges the code for an access token, stores/updates the shop record, and redirects back into the embedded frontend.

### Q: How does the embedded app flow work?

A: `/app` receives `shop` and `host`, checks whether the store is installed, redirects to OAuth if needed, otherwise redirects into the Vite frontend with embedded context. The frontend initializes App Bridge when `shop`, `host`, and API key are available.

### Q: What security tradeoff did you make?

A: API routes are demo-oriented and use `storeId=1` in the frontend. In production, I would verify Shopify App Bridge session tokens on API requests and derive the store ID from the authenticated shop instead of accepting it from the query string.

### Q: Why include mock data?

A: It reduces setup friction for evaluators. They can inspect the UI even if MySQL or Shopify credentials are not running. The API remains implemented, but the demo remains resilient.

### Q: What does the tea quiz do?

A: Each answer option has weighted scores for tea categories. The quiz accumulates scores across four questions, sorts categories by score, and recommends the top three tea matches with match percentages.

### Q: Why use vanilla JS in the theme?

A: The theme requirement called for Liquid, CSS, and minimal JavaScript. The quiz and map interactions are focused scripts rather than a large frontend framework.

### Q: What are the custom theme sections?

A: Hero parallax, featured collection, origin map, brewing guide, tea quiz, testimonials, and newsletter. The required minimum was three, so the theme exceeds that.

### Q: How would you make the alert actions real?

A: For discounts, I would call Shopify Admin API price rule or discount APIs. For email, I would integrate a transactional email provider. For webhooks, I would add a dispatcher with retry logic, status tracking, and signed payloads.

### Q: How would you add FEFO?

A: I would listen to order webhooks, map order line items to products, then recommend or reserve inventory from the batch with the nearest expiry date or lowest freshness score that still has available quantity.

### Q: How would you test this?

A: I would unit test `calculateFreshness`, status thresholds, sold-out handling, and alert threshold crossing. Then I would add API integration tests for batch creation/update and dashboard recalculation. For the UI, I would add Playwright tests for the batch workflow and tea quiz.

### Q: What are the biggest limitations?

A: Real Shopify discount/email/webhook execution is stubbed as activity logs. API authentication is demo-oriented. Background recalculation is not implemented. There is no full automated test suite yet.

### Q: What would you improve first with more time?

A: Shopify session-token authentication, real Admin API integrations, webhook sync for products/orders, scheduled freshness recalculation, and tests around freshness and alert edge cases.

## Code References To Mention

- Theme homepage sections: `theme/templates/index.liquid`
- Tea quiz markup: `theme/sections/tea-quiz.liquid`
- Tea quiz scoring: `theme/assets/quiz.js`
- Product page: `theme/templates/product.liquid`
- Cart page: `theme/templates/cart.liquid`
- Express entry: `app/server/index.js`
- Drizzle schema: `app/server/db/schema.js`
- Migration: `app/server/db/migrations/0000_initial_schema.sql`
- Freshness engine: `app/server/services/freshness.js`
- Shopify OAuth: `app/server/routes/auth.js`
- Embedded launch: `app/server/routes/embedded.js`
- Dashboard route: `app/server/routes/dashboard.js`
- Batch workflow UI: `app/frontend/src/components/BatchManager.jsx`
- Alert rules UI: `app/frontend/src/components/AlertRules.jsx`
- Activity log UI: `app/frontend/src/components/ActivityLog.jsx`
- App Bridge helper: `app/frontend/src/shopifyAppBridge.js`

## Things To Say If Asked About Tradeoffs

Recalculate on read:

"For this take-home, correctness and easy local review were more important than background infrastructure. In production I would add a cron worker."

Mock data:

"The mock fallback makes the UI reviewable without MySQL, but the API routes and schema are still implemented."

Logged alert actions:

"The app currently logs discount/email/webhook actions to show the event pipeline. The production step would be dispatching those actions through Shopify Admin API and external services."

Session auth:

"The app demonstrates the embedded flow, but production API routes should verify App Bridge session tokens and resolve the store from the token."

## Closing Statement

This project was designed to show both storefront craft and merchant workflow thinking. Verdant Leaf proves the brand and customer experience; FreshTrack proves the operational layer that a real merchant would need behind that store.
