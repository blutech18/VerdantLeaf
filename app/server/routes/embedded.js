/**
 * FreshTrack — Embedded App Launch Routes
 * Handles the Shopify Admin app URL and redirects into the Vite frontend.
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { stores } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function normalizeShop(shop) {
  if (!shop || typeof shop !== 'string') return null;
  const trimmed = shop.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(trimmed) ? trimmed : null;
}

function fallbackHost(shop) {
  return Buffer.from(`${shop}/admin`).toString('base64');
}

function buildFrontendUrl({ shop, host }) {
  const url = new URL(FRONTEND_URL);
  url.searchParams.set('shop', shop);
  url.searchParams.set('host', host || fallbackHost(shop));
  url.searchParams.set('embedded', '1');
  return url;
}

/**
 * GET /app?shop=example.myshopify.com&host=...
 * Shopify Admin loads this app URL inside an iframe after installation.
 */
router.get('/app', async (req, res) => {
  const shop = normalizeShop(req.query.shop);
  const host = typeof req.query.host === 'string' ? req.query.host : '';

  if (!shop) {
    return res.status(400).json({ error: 'Missing or invalid shop parameter' });
  }

  const installedStore = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.shopifyDomain, shop))
    .limit(1);

  if (installedStore.length === 0) {
    const installUrl = new URL('/auth', `${req.protocol}://${req.get('host')}`);
    installUrl.searchParams.set('shop', shop);
    if (host) installUrl.searchParams.set('host', host);
    return res.redirect(installUrl.toString());
  }

  return res.redirect(buildFrontendUrl({ shop, host }).toString());
});

/**
 * GET /api/app-context?shop=example.myshopify.com
 * Small embedded-app metadata endpoint for the frontend and reviewers.
 */
router.get('/api/app-context', (req, res) => {
  const shop = normalizeShop(req.query.shop);

  res.json({
    apiKey: process.env.SHOPIFY_API_KEY || '',
    embedded: Boolean(shop),
    shop,
    appName: 'FreshTrack',
  });
});

export { normalizeShop };
export default router;
