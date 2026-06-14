import createApp from '@shopify/app-bridge';
import { TitleBar } from '@shopify/app-bridge/actions';
import { getSessionToken } from '@shopify/app-bridge/utilities';

const API_KEY = import.meta.env.VITE_SHOPIFY_API_KEY || '';

let appInstance = null;

/**
 * Returns a fresh Shopify session token (JWT) for authenticating API calls,
 * or null when not running embedded (local dev). App Bridge rotates these
 * short-lived tokens automatically on each request.
 */
export async function getAppBridgeSessionToken() {
  if (!appInstance) return null;
  try {
    return await getSessionToken(appInstance);
  } catch {
    return null;
  }
}

export function getEmbeddedContext(search = window.location.search) {
  const params = new URLSearchParams(search);
  const shop = params.get('shop') || '';
  const host = params.get('host') || '';
  const embedded = params.get('embedded') === '1' || Boolean(shop && host);

  return {
    apiKey: API_KEY,
    embedded,
    host,
    shop,
  };
}

export function initializeShopifyAppBridge(search = window.location.search) {
  const context = getEmbeddedContext(search);

  if (!context.embedded || !context.apiKey || !context.host) {
    return { app: null, context };
  }

  const app = createApp({
    apiKey: context.apiKey,
    host: context.host,
    forceRedirect: true,
  });

  appInstance = app;
  TitleBar.create(app, { title: 'FreshTrack' });

  window.__FRESHTRACK_APP_BRIDGE__ = app;
  return { app, context };
}

export function embeddedSearch(search) {
  const context = getEmbeddedContext(search);
  if (!context.embedded) return '';

  const params = new URLSearchParams();
  params.set('shop', context.shop);
  params.set('host', context.host);
  params.set('embedded', '1');
  return `?${params.toString()}`;
}
