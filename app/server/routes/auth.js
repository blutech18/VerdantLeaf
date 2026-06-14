/**
 * FreshTrack — Shopify OAuth Routes
 * Handles app installation and OAuth callback flow
 */

import '../config/env.js';
import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { stores } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { normalizeShop } from './embedded.js';
import { syncProductsFromShopify } from '../services/productSync.js';
import { registerProductWebhooks } from '../services/shopify.js';
import { encryptToken } from '../utils/crypto.js';

const router = Router();

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
const SHOPIFY_SCOPES = 'read_products,write_products,read_inventory';
const HOST = process.env.HOST || 'http://localhost:3000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const USE_HTTPS = HOST.startsWith('https://');

// Cookies must be Secure + SameSite=None when OAuth runs over HTTPS (ngrok tunnel).
const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: USE_HTTPS ? 'none' : 'lax',
  secure: USE_HTTPS,
  path: '/',
  maxAge: 10 * 60 * 1000,
};

function readCookie(req, name) {
  const cookies = req.headers.cookie?.split(';') || [];
  const match = cookies
    .map(cookie => cookie.trim().split('='))
    .find(([key]) => key === name);
  return match ? decodeURIComponent(match[1]) : null;
}

function safeCompareHex(left, right) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function fallbackHost(shop) {
  return Buffer.from(`${shop}/admin`).toString('base64');
}

function buildEmbeddedRedirect(shop, host) {
  const url = new URL(FRONTEND_URL);
  url.searchParams.set('shop', shop);
  url.searchParams.set('host', host || fallbackHost(shop));
  url.searchParams.set('embedded', '1');
  return url.toString();
}

/**
 * GET /auth
 * Initiates OAuth flow — redirects merchant to Shopify permission screen
 */
router.get('/', (req, res) => {
  const shop = normalizeShop(req.query.shop);
  const host = typeof req.query.host === 'string' ? req.query.host : '';
  if (!shop) return res.status(400).json({ error: 'Missing shop parameter' });
  if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
    return res.status(500).json({ error: 'Shopify credentials are not configured' });
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${HOST}/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize?` +
    `client_id=${SHOPIFY_API_KEY}` +
    `&scope=${SHOPIFY_SCOPES}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${nonce}`;

  // Store nonce in a cookie for validation
  res.cookie('shopify_nonce', nonce, OAUTH_COOKIE_OPTIONS);
  if (host) {
    res.cookie('shopify_host', host, OAUTH_COOKIE_OPTIONS);
  }
  res.redirect(installUrl);
});

/**
 * GET /auth/callback
 * Handles OAuth callback — exchanges code for access token
 */
router.get('/callback', async (req, res) => {
  const { code, hmac, state } = req.query;
  const shop = normalizeShop(req.query.shop);
  const host = typeof req.query.host === 'string' ? req.query.host : readCookie(req, 'shopify_host');

  if (!shop || !code || !hmac) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const storedState = readCookie(req, 'shopify_nonce');
  if (!state || !storedState || state !== storedState) {
    return res.status(401).json({ error: 'OAuth state validation failed' });
  }

  // Verify HMAC signature
  const params = { ...req.query };
  delete params.hmac;
  delete params.signature;

  const sortedParams = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  const computedHmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(sortedParams)
    .digest('hex');

  if (!safeCompareHex(computedHmac, hmac)) {
    return res.status(401).json({ error: 'HMAC validation failed' });
  }

  try {
    // Exchange code for permanent access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenResponse.status, await tokenResponse.text());
      return res.status(502).json({ error: 'Failed to exchange authorization code with Shopify' });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(502).json({ error: 'Shopify did not return an access token' });
    }

    // Fetch shop details
    const shopResponse = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });
    const shopData = await shopResponse.json();

    // Encrypt the access token before it ever touches the database.
    const storedToken = encryptToken(accessToken);

    // Upsert store record
    const existing = await db.select().from(stores).where(eq(stores.shopifyDomain, shop));
    let storeId;

    if (existing.length > 0) {
      await db.update(stores)
        .set({ accessToken: storedToken, shopName: shopData.shop?.name, email: shopData.shop?.email })
        .where(eq(stores.shopifyDomain, shop));
      storeId = existing[0].id;
    } else {
      const [inserted] = await db.insert(stores).values({
        shopifyDomain: shop,
        accessToken: storedToken,
        shopName: shopData.shop?.name || shop,
        email: shopData.shop?.email || '',
      });
      storeId = inserted.insertId;
    }

    // Post-install: mirror Shopify catalog (auto-creates a batch per product)
    // + register product webhooks (non-blocking)
    const storeRecord = { shopifyDomain: shop, accessToken };
    syncProductsFromShopify(storeId).catch(err => {
      console.warn('Post-install product sync failed:', err.message);
    });
    registerProductWebhooks(storeRecord).catch(err => {
      console.warn('Webhook registration failed:', err.message);
    });

    // Redirect to the embedded app
    res.clearCookie('shopify_nonce');
    res.clearCookie('shopify_host');
    res.redirect(buildEmbeddedRedirect(shop, host));
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'OAuth flow failed' });
  }
});

export default router;
