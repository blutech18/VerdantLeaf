/**
 * FreshTrack — Shopify session-token (JWT) authentication
 *
 * Embedded apps authenticate every API call with a short-lived session token
 * issued by App Bridge (sent as `Authorization: Bearer <jwt>`). The token is a
 * JWT signed with HS256 using the app's API secret, so we can verify it with
 * Node's built-in crypto — no extra dependency required.
 *
 * Verified claims (per Shopify spec):
 *   - signature  → HMAC-SHA256 with SHOPIFY_API_SECRET
 *   - exp / nbf  → not expired / not used before valid
 *   - aud        → equals our SHOPIFY_API_KEY
 *   - dest       → the shop the request is for (drives store resolution)
 *
 * On success the request is scoped to the authenticated shop:
 *   req.shop, req.storeId, req.store
 *
 * Local dev fallback: when NODE_ENV !== 'production' and no token is present,
 * the request falls back to the `?storeId`/`?shop` query params (demo store 1)
 * so the app can run without a Shopify tunnel. In production a valid token is
 * mandatory.
 */

import crypto from 'crypto';
import { db } from '../db/index.js';
import { stores } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { normalizeShop } from '../routes/embedded.js';

const CLOCK_TOLERANCE_SECONDS = 10;

function base64UrlDecode(segment) {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

function safeCompare(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * Verifies a Shopify App Bridge session token. Returns the decoded payload or
 * throws an Error describing why verification failed.
 */
export function verifySessionToken(token) {
  const secret = process.env.SHOPIFY_API_SECRET || '';
  const apiKey = process.env.SHOPIFY_API_KEY || '';
  if (!secret) throw new Error('SHOPIFY_API_SECRET is not configured');

  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('Malformed session token');

  const [headerB64, payloadB64, signatureB64] = parts;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (!safeCompare(expectedSig, signatureB64)) {
    throw new Error('Invalid session token signature');
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
  } catch {
    throw new Error('Unreadable session token payload');
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && now > payload.exp + CLOCK_TOLERANCE_SECONDS) {
    throw new Error('Session token expired');
  }
  if (typeof payload.nbf === 'number' && now < payload.nbf - CLOCK_TOLERANCE_SECONDS) {
    throw new Error('Session token not yet valid');
  }
  if (apiKey && payload.aud !== apiKey) {
    throw new Error('Session token audience mismatch');
  }

  return payload;
}

/** Extracts the *.myshopify.com domain from a session token `dest` claim. */
export function shopFromToken(payload) {
  try {
    const host = new URL(payload.dest).host;
    return normalizeShop(host);
  } catch {
    return null;
  }
}

async function resolveStoreId(shop) {
  if (!shop) return null;
  const rows = await db
    .select({ id: stores.id, shopifyDomain: stores.shopifyDomain })
    .from(stores)
    .where(eq(stores.shopifyDomain, shop))
    .limit(1);
  return rows[0] || null;
}

/**
 * Express middleware: authenticates the request and scopes it to a store.
 * Sets req.shop, req.storeId and req.store.
 */
export async function resolveStore(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (bearer) {
      let payload;
      try {
        payload = verifySessionToken(bearer);
      } catch (err) {
        return res.status(401).json({ error: `Authentication failed: ${err.message}` });
      }

      const shop = shopFromToken(payload);
      const store = await resolveStoreId(shop);
      if (!store) {
        return res.status(403).json({ error: 'Shop is not installed. Complete OAuth at /auth first.' });
      }

      req.shop = store.shopifyDomain;
      req.storeId = store.id;
      req.store = store;
      return next();
    }

    // No token — only allowed outside production (local demo without a tunnel).
    const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
    if (isProduction) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const shop = normalizeShop(req.query.shop);
    const store = shop ? await resolveStoreId(shop) : null;
    req.shop = store?.shopifyDomain || shop || null;
    req.storeId = store?.id || parseInt(req.query.storeId || '1', 10);
    req.store = store;
    return next();
  } catch (error) {
    return next(error);
  }
}
