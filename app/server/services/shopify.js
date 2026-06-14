/**
 * FreshTrack — Shopify Admin API helpers
 *
 * Used by OAuth install, product sync, and webhook registration.
 * Supports a custom-app admin token in .env for local development while
 * keeping OAuth as the canonical embedded-app install path.
 */

import crypto from 'crypto';
import { db } from '../db/index.js';
import { stores } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { ValidationError } from '../utils/validation.js';
import { decryptToken } from '../utils/crypto.js';

const API_VERSION = '2024-01';
const DEMO_TOKEN_MARKER = 'demo';

export const SHELF_LIFE_BY_CATEGORY = {
  green_tea: 180,
  black_tea: 240,
  oolong: 210,
  white_tea: 365,
  puerh: 730,
  herbal: 365,
  matcha: 120,
  other: 180,
};

/**
 * Maps a Shopify catalog product to a FreshTrack category enum.
 */
export function inferCategory({ product_type: productType = '', tags = '', title = '' }) {
  const lookup = `${productType} ${Array.isArray(tags) ? tags.join(' ') : tags} ${title}`.toLowerCase();

  if (lookup.includes('matcha')) return 'matcha';
  if (lookup.includes('puerh') || lookup.includes('pu-erh') || lookup.includes('pu er')) return 'puerh';
  if (lookup.includes('oolong')) return 'oolong';
  if (lookup.includes('white')) return 'white_tea';
  if (lookup.includes('black') || lookup.includes('darjeeling')) return 'black_tea';
  if (lookup.includes('herbal') || lookup.includes('chamomile')) return 'herbal';
  if (lookup.includes('green') || lookup.includes('sencha') || lookup.includes('jasmine')) return 'green_tea';

  const type = String(productType).toLowerCase();
  if (type.includes('green')) return 'green_tea';
  if (type.includes('black')) return 'black_tea';
  if (type.includes('oolong')) return 'oolong';
  if (type.includes('white')) return 'white_tea';
  if (type.includes('herbal')) return 'herbal';
  if (type.includes('matcha')) return 'matcha';

  return 'other';
}

export function isPublicHost(hostUrl) {
  try {
    const { hostname } = new URL(hostUrl);
    return hostname !== 'localhost' && hostname !== '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Resolves the store record and the OAuth access token from install.
 * Product sync requires a real token from /auth — demo seed tokens are rejected.
 */
export async function getStoreWithToken(storeId) {
  const rows = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (rows.length === 0) {
    throw new ValidationError('Store not found. Install the app via OAuth first (/auth?shop=...).');
  }

  const store = rows[0];
  const accessToken = decryptToken(store.accessToken);
  const tokenLooksDemo = !accessToken || accessToken.includes(DEMO_TOKEN_MARKER);

  if (tokenLooksDemo) {
    throw new ValidationError(
      'App not installed. Complete OAuth at /auth?shop=verdantleafshop.myshopify.com first.'
    );
  }

  return { ...store, accessToken, tokenSource: 'oauth' };
}

export async function shopifyAdminFetch(store, path, { method = 'GET', body } = {}) {
  const url = `https://${store.shopifyDomain}/admin/api/${API_VERSION}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify API ${response.status}: ${text.slice(0, 300)}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

/**
 * Paginates through all products in the connected Shopify store.
 */
export async function fetchAllShopifyProducts(store) {
  const products = [];
  let sinceId = 0;

  while (true) {
    const path = sinceId
      ? `/products.json?limit=250&since_id=${sinceId}`
      : '/products.json?limit=250';
    const data = await shopifyAdminFetch(store, path);
    const batch = data.products || [];
    if (batch.length === 0) break;

    products.push(...batch);
    sinceId = batch[batch.length - 1].id;
    if (batch.length < 250) break;
  }

  return products;
}

export function verifyWebhookHmac(rawBody, hmacHeader) {
  const secret = process.env.SHOPIFY_API_SECRET || '';
  if (!secret || !hmacHeader) return false;

  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const digestBuffer = Buffer.from(digest);
  const hmacBuffer = Buffer.from(hmacHeader);

  return digestBuffer.length === hmacBuffer.length && crypto.timingSafeEqual(digestBuffer, hmacBuffer);
}

const WEBHOOK_TOPICS = ['products/create', 'products/update', 'products/delete'];

/**
 * Registers product webhooks after OAuth install (requires a public HOST URL).
 */
export async function registerProductWebhooks(store) {
  const host = process.env.HOST || '';
  if (!isPublicHost(host) && process.env.SHOPIFY_FORCE_WEBHOOKS !== 'true') {
    console.log('Skipping webhook registration — HOST is not public. Use ngrok + SHOPIFY_FORCE_WEBHOOKS=true for real-time sync.');
    return { registered: [], skipped: true };
  }

  const registered = [];
  for (const topic of WEBHOOK_TOPICS) {
    const address = `${host.replace(/\/$/, '')}/webhooks/products`;
    try {
      await shopifyAdminFetch(store, '/webhooks.json', {
        method: 'POST',
        body: { webhook: { topic, address, format: 'json' } },
      });
      registered.push(topic);
    } catch (error) {
      // Shopify returns 422 if the webhook already exists — treat as success
      if (String(error.message).includes('422')) {
        registered.push(`${topic} (exists)`);
      } else {
        console.warn(`Webhook ${topic} registration failed:`, error.message);
      }
    }
  }

  return { registered, skipped: false };
}
