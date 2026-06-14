/**
 * FreshTrack — Shopify product webhooks
 *
 * Keeps the FreshTrack product catalog in sync when merchants edit products
 * in Shopify admin. Requires a public HOST (ngrok) for Shopify to deliver events.
 */

import { Router } from 'express';
import { verifyWebhookHmac } from '../services/shopify.js';
import {
  getStoreIdByDomain,
  removeShopifyProduct,
  upsertShopifyProduct,
} from '../services/productSync.js';
import { respondWithError } from '../utils/validation.js';

const router = Router();

function parseWebhookPayload(req) {
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  const rawBody = req.body?.toString?.('utf8') || '';

  if (!verifyWebhookHmac(rawBody, hmac)) {
    const err = new Error('Webhook HMAC validation failed');
    err.statusCode = 401;
    throw err;
  }

  return JSON.parse(rawBody || '{}');
}

async function handleProductWebhook(req, res, action) {
  try {
    const shop = req.get('X-Shopify-Shop-Domain');
    if (!shop) return res.status(400).json({ error: 'Missing shop domain header' });

    const payload = parseWebhookPayload(req);
    const storeId = await getStoreIdByDomain(shop);
    if (!storeId) return res.status(404).json({ error: 'Store not installed' });

    const shopifyProduct = payload;
    const productId = shopifyProduct?.id;
    if (!productId) return res.status(400).json({ error: 'Missing product id' });

    if (action === 'delete') {
      await removeShopifyProduct(storeId, productId);
    } else {
      await upsertShopifyProduct(storeId, shopifyProduct);
    }

    res.json({ ok: true, action, productId });
  } catch (error) {
    if (error.statusCode === 401) {
      return res.status(401).json({ error: error.message });
    }
    respondWithError(res, error, 'Webhook processing failed');
  }
}

router.post('/products', (req, res) => handleProductWebhook(req, res, req.get('X-Shopify-Topic')?.split('/').pop() || 'update'));

export default router;
