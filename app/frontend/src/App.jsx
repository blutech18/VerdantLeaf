import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import BatchManager from './components/BatchManager';
import AlertRules from './components/AlertRules';
import ActivityLog from './components/ActivityLog';
import { embeddedSearch, getEmbeddedContext, initializeShopifyAppBridge } from './shopifyAppBridge';

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const location = useLocation();
  const [embeddedContext, setEmbeddedContext] = useState(() => getEmbeddedContext(location.search));

  useEffect(() => {
    const { context } = initializeShopifyAppBridge(location.search);
    setEmbeddedContext(context);
  }, [location.search]);

  const shopifySearch = useMemo(() => embeddedSearch(location.search), [location.search]);
  const navTo = (pathname) => ({ pathname, search: shopifySearch });
  const storeUrl = embeddedContext.shop || 'verdantleaf.myshopify.com';

  return (
      <div className="app">
        {/* Sidebar Navigation */}
        <aside className="sidebar">
          <div className="sidebar__brand">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <path d="M16 2C16 2 6 10 6 18c0 5.523 4.477 10 10 10s10-4.477 10-10C26 10 16 2 16 2z" fill="#c8a45c" opacity="0.2"/>
              <path d="M16 6c0 0-7 5.5-7 11a7 7 0 0014 0c0-5.5-7-11-7-11z" fill="#c8a45c" opacity="0.4"/>
              <path d="M16 10c0 0-4 3.5-4 7a4 4 0 008 0c0-3.5-4-7-4-7z" fill="#c8a45c"/>
            </svg>
            <span className="sidebar__brand-text">FreshTrack</span>
          </div>

          <nav className="sidebar__nav">
            <NavLink to={navTo('/')} end className={({isActive}) => `sidebar__link ${isActive ? 'active' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              <span>Dashboard</span>
            </NavLink>
            <NavLink to={navTo('/batches')} className={({isActive}) => `sidebar__link ${isActive ? 'active' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              <span>Batches</span>
            </NavLink>
            <NavLink to={navTo('/alerts')} className={({isActive}) => `sidebar__link ${isActive ? 'active' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              <span>Alert Rules</span>
            </NavLink>
            <NavLink to={navTo('/logs')} className={({isActive}) => `sidebar__link ${isActive ? 'active' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <span>Activity Log</span>
            </NavLink>
          </nav>

          <div className="sidebar__footer">
            <div className="sidebar__store">
              <div className="sidebar__store-avatar">V</div>
              <div>
                <div className="sidebar__store-name">Verdant Leaf</div>
                <div className="sidebar__store-url">{storeUrl}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/batches" element={<BatchManager />} />
            <Route path="/alerts" element={<AlertRules />} />
            <Route path="/logs" element={<ActivityLog />} />
          </Routes>
        </main>
      </div>
  );
}
