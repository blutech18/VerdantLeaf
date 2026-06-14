/**
 * FreshTrack — Express Server Entry Point
 * Shopify Embedded App Backend
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import './config/env.js';

import authRoutes from './routes/auth.js';
import batchRoutes from './routes/batches.js';
import alertRoutes from './routes/alerts.js';
import dashboardRoutes from './routes/dashboard.js';
import logRoutes from './routes/logs.js';
import productRoutes from './routes/products.js';
import embeddedRoutes, { normalizeShop } from './routes/embedded.js';
import webhookRoutes from './routes/webhooks.js';
import { resolveStore } from './utils/sessionAuth.js';

const app = express();
const PORT = process.env.PORT || 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_PATH = path.resolve(__dirname, '../frontend/dist');
const HAS_BUILT_FRONTEND = fs.existsSync(path.join(DIST_PATH, 'index.html'));

// Middleware
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
}));

// Webhooks need the raw body for HMAC verification (must be before express.json)
app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Allow Shopify Admin to embed the app iframe.
app.use((req, res, next) => {
  const shop = normalizeShop(req.query.shop || req.headers['x-shopify-shop-domain']);
  const frameAncestors = shop
    ? `https://${shop} https://admin.shopify.com`
    : 'https://*.myshopify.com https://admin.shopify.com';

  res.setHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors};`);
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'FreshTrack', version: '1.0.0' });
});

// Routes
app.use('/', embeddedRoutes);
app.use('/auth', authRoutes);

// Authenticated data routes — scoped to the session-token's shop (see sessionAuth).
app.use('/api/batches', resolveStore, batchRoutes);
app.use('/api/alerts', resolveStore, alertRoutes);
app.use('/api/dashboard', resolveStore, dashboardRoutes);
app.use('/api/logs', logRoutes); // GET is authenticated inside the router; /track is public for the storefront
app.use('/api/products', resolveStore, productRoutes);

// Serve the built React app (production single-service deploy). In dev the Vite
// server handles this instead. API/auth/webhook paths are excluded from the
// SPA fallback so they keep returning JSON.
if (HAS_BUILT_FRONTEND) {
  app.use(express.static(DIST_PATH));
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/auth') ||
      req.path.startsWith('/webhooks') ||
      req.path === '/health'
    ) {
      return next();
    }
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\nFreshTrack server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API:    http://localhost:${PORT}/api`);
  console.log(`   Env:    ${process.env.APP_ENV || process.env.NODE_ENV || 'development'}`);
  console.log(`   Frontend: ${HAS_BUILT_FRONTEND ? 'serving frontend/dist (single-service)' : 'not built — run "npm run build" in frontend/ for production'}\n`);
});
