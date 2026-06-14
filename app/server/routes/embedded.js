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
const HOST = process.env.HOST || 'http://localhost:3000';
const DEFAULT_SHOP = process.env.SHOPIFY_SHOP_DOMAIN || 'verdantleafshop.myshopify.com';

function hasValidOAuthToken(accessToken) {
  if (!accessToken) return false;
  // Real OAuth tokens are stored encrypted (enc:v1:...); demo seed tokens are
  // plaintext and contain "demo".
  if (accessToken.startsWith('enc:')) return true;
  return !accessToken.includes('demo');
}

function buildInstallUrl(shop, host = '') {
  const installUrl = new URL('/auth', HOST);
  installUrl.searchParams.set('shop', shop);
  if (host) installUrl.searchParams.set('host', host);
  return installUrl.toString();
}

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
    .select({ id: stores.id, accessToken: stores.accessToken })
    .from(stores)
    .where(eq(stores.shopifyDomain, shop))
    .limit(1);

  if (installedStore.length === 0 || !hasValidOAuthToken(installedStore[0].accessToken)) {
    return res.redirect(buildInstallUrl(shop, host));
  }

  return res.redirect(buildFrontendUrl({ shop, host }).toString());
});

/**
 * GET /api/install-status?storeId=1&shop=example.myshopify.com
 * Tells the frontend whether OAuth install completed (real token, not demo seed).
 */
router.get('/api/install-status', async (req, res) => {
  const storeId = parseInt(req.query.storeId || '1', 10);
  const shop = normalizeShop(req.query.shop);

  let rows;
  if (shop) {
    rows = await db.select().from(stores).where(eq(stores.shopifyDomain, shop)).limit(1);
  } else {
    rows = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  }

  const store = rows[0];
  const shopDomain = store?.shopifyDomain || shop || normalizeShop(DEFAULT_SHOP);
  const installed = hasValidOAuthToken(store?.accessToken);

  res.json({
    installed,
    storeId: store?.id || null,
    shop: shopDomain,
    installUrl: buildInstallUrl(shopDomain),
    embedded: Boolean(shop),
  });
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
