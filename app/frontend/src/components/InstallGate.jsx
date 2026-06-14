import React from 'react';

const API_HOST = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

export default function InstallGate({ shop = 'verdantleafshop.myshopify.com', installUrl }) {
  const oauthUrl = installUrl || `${API_HOST}/auth?shop=${encodeURIComponent(shop)}`;

  return (
    <div className="install-gate">
      <div className="install-gate__card">
        <img src="/verdant-leaf-logo-green.png" alt="Verdant Leaf" className="install-gate__logo" />
        <h1>Connect FreshTrack</h1>
        <p>
          Install FreshTrack via Shopify OAuth to sync your product catalog and manage batch freshness
          inside your store admin.
        </p>
        <a className="btn btn--primary btn--lg" href={oauthUrl}>
          Install via Shopify OAuth
        </a>
        <p className="install-gate__hint">
          After approving permissions, you&apos;ll land in the embedded app with products synced from{' '}
          <strong>{shop}</strong>.
        </p>
      </div>
    </div>
  );
}
