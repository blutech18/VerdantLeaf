/**
 * FreshTrack — Express Server Entry Point
 * Shopify Embedded App Backend
 */

import express from 'express';
import cors from 'cors';
import './config/env.js';

import authRoutes from './routes/auth.js';
import batchRoutes from './routes/batches.js';
import alertRoutes from './routes/alerts.js';
import dashboardRoutes from './routes/dashboard.js';
import logRoutes from './routes/logs.js';
import productRoutes from './routes/products.js';
import embeddedRoutes, { normalizeShop } from './routes/embedded.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
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
app.use('/api/batches', batchRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/products', productRoutes);

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
  console.log(`   API:    http://localhost:${PORT}/api\n`);
});
