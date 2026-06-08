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
shopify theme push --store your-store.myshopify.com
```

### Local Development
```bash
cd theme
shopify theme dev --store your-store.myshopify.com
```

### Theme Features
- **Core Pages**: Home, Collection, Product, Cart
- **3 Custom Sections**: Hero Parallax, Tea Origin Map (interactive SVG), Brewing Guide
- **Standout Feature**: Tea Profile Quiz — 4-question quiz with weighted scoring algorithm that recommends teas
- **Design**: Shopify-safe native serif + system sans typography, earth-tone palette, scroll animations, parallax effects

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
```

### 2. Set Up Database
```bash
# Create MySQL database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS freshtrack;"

# Run migrations and optional demo seed data
cd app/server
npm install
npm run migrate
npm run seed
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

### 4. Access the App
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health
- **Embedded launch URL**: http://localhost:3000/app?shop=your-store.myshopify.com&host=BASE64_HOST

> **Note**: The frontend uses mock data when the backend API is unavailable, so you can review the UI without setting up MySQL. When Shopify Admin supplies `shop` and `host` query params, the frontend initializes Shopify App Bridge and preserves the embedded context through navigation.

### App Features
| Feature | Description |
|---------|-------------|
| **Dashboard** | Real-time metrics: avg freshness, waste rate, at-risk batches, freshness distribution bar |
| **Batch Management** | Create/edit batches with lot numbers, dates, quantities. Live freshness score calculation |
| **Alert Rules** | Configurable threshold-action pairs (auto-discount, email, webhook). Event-driven evaluation |
| **Activity Log** | Full audit trail grouped by date, filterable by action type |
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
| GET/POST | `/api/products` | List/create products |
| GET | `/app` | Embedded Shopify Admin launch route |
| GET | `/api/app-context` | Embedded app metadata |
| GET | `/auth` | Initiate Shopify OAuth |
| GET | `/auth/callback` | OAuth callback handler |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Theme | Shopify Liquid + CSS + Vanilla JS |
| Frontend | Vite 6 + React 18 + React Router 6 + Shopify App Bridge |
| Backend | Node.js + Express 4 |
| Database | MySQL 8 + Drizzle ORM |
| Auth | Shopify OAuth 2.0 |
