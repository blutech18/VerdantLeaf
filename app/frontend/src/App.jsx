import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import BatchManager from './components/BatchManager';
import AlertRules from './components/AlertRules';
import ActivityLog from './components/ActivityLog';
import InstallGate from './components/InstallGate';
import { embeddedSearch, getEmbeddedContext, initializeShopifyAppBridge, getAppBridgeSessionToken } from './shopifyAppBridge';
import { ToastProvider } from './components/Toast';
import { BellIcon, CloseIcon, ClipboardIcon, MenuIcon, ChevronLeftIcon, CheckCircleIcon } from './components/Icons';
import { api, configureStore, registerSessionTokenGetter } from './api';
import { getActivityMeta } from './utils/activityMeta';
import { formatActivityText } from './utils/activity';
import { timeAgo } from './utils/format';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </BrowserRouter>
  );
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [embeddedContext, setEmbeddedContext] = useState(() => getEmbeddedContext(location.search));
  const [installState, setInstallState] = useState({ loading: true, installed: false, installUrl: '' });
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  /* Track which notifications have been seen (stored in localStorage) */
  const [seenNotifIds, setSeenNotifIds] = useState(() => {
    try {
      const stored = localStorage.getItem('ft_seen_notifs');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  /* Desktop: icon-only rail. Persisted so the choice survives reloads. */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('ft_sidebar_collapsed') === '1'; } catch { return false; }
  });
  /* Mobile: off-canvas drawer open/close state. */
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('ft_sidebar_collapsed', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  /* Persist seen notification IDs to localStorage */
  const persistSeenIds = useCallback((ids) => {
    try {
      localStorage.setItem('ft_seen_notifs', JSON.stringify([...ids]));
    } catch { /* ignore */ }
  }, []);

  /* Mark all notifications as seen */
  const markAllAsSeen = useCallback(() => {
    const allIds = new Set(notifications.map(n => n.id));
    setSeenNotifIds(allIds);
    persistSeenIds(allIds);
  }, [notifications, persistSeenIds]);

  /* Mark a single notification as seen */
  const markAsSeen = useCallback((id) => {
    setSeenNotifIds(prev => {
      const next = new Set(prev);
      next.add(id);
      persistSeenIds(next);
      return next;
    });
  }, [persistSeenIds]);

  /* Get the navigation target for a notification based on its action type */
  const getNotifNavTarget = useCallback((entry) => {
    const action = entry?.action;
    // Batch-related actions → go to Batches page
    if (['batch_created', 'batch_updated', 'score_updated', 'batch_expired', 
         'batch_sold_out', 'discount_applied'].includes(action)) {
      return '/batches';
    }
    // Alert/rule-related actions → go to Alert Rules page
    if (['alert_triggered', 'rule_created', 'rule_updated', 'rule_deleted'].includes(action)) {
      return '/alerts';
    }
    // Default to Activity Log for anything else
    return '/logs';
  }, []);

  /* Count of unseen notifications */
  const unseenCount = useMemo(() => {
    return notifications.filter(n => !seenNotifIds.has(n.id)).length;
  }, [notifications, seenNotifIds]);

  const fetchNotifications = useCallback(async () => {
    try {
      setNotifLoading(true);
      const data = await api.getNotifications({ limit: 10 });
      setNotifications(data.logs || []);
    } catch {
      /* silent — drawer will show empty state */
    } finally {
      setNotifLoading(false);
    }
  }, []);

  /* Fetch notifications when the drawer opens + poll every 30s while open */
  useEffect(() => {
    if (!isNotifDrawerOpen) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [isNotifDrawerOpen, fetchNotifications]);

  useEffect(() => {
    const { app, context } = initializeShopifyAppBridge(location.search);
    // Authenticate API calls with App Bridge session tokens when embedded.
    registerSessionTokenGetter(app ? getAppBridgeSessionToken : null);
    setEmbeddedContext(context);
  }, [location.search]);

  useEffect(() => {
    const shop = getEmbeddedContext(location.search).shop;
    api.getInstallStatus(shop || undefined)
      .then((status) => {
        if (status.storeId) configureStore({ id: status.storeId });
        setInstallState({ loading: false, ...status });
      })
      .catch(() => setInstallState({
        loading: false,
        installed: false,
        shop: shop || 'verdantleafshop.myshopify.com',
        installUrl: 'http://localhost:3000/auth?shop=verdantleafshop.myshopify.com',
      }));
  }, [location.search]);

  const shopifySearch = useMemo(() => embeddedSearch(location.search), [location.search]);
  const navTo = (pathname) => ({ pathname, search: shopifySearch });
  const storeUrl = embeddedContext.shop || installState.shop || 'verdantleafshop.myshopify.com';

  /* Handle notification click - mark as seen and navigate */
  const handleNotifClick = useCallback((entry) => {
    markAsSeen(entry.id);
    const target = getNotifNavTarget(entry);
    setIsNotifDrawerOpen(false);
    navigate({ pathname: target, search: shopifySearch });
  }, [markAsSeen, getNotifNavTarget, navigate, shopifySearch]);

  /* Close the mobile nav drawer whenever the route changes. */
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  if (installState.loading) {
    return (
      <div className="install-gate">
        <div className="loading-state" style={{ minHeight: '100vh' }}>
          <div className="spinner" />
          Checking Shopify connection…
        </div>
      </div>
    );
  }

  if (!installState.installed) {
    return <InstallGate shop={storeUrl} installUrl={installState.installUrl} />;
  }

  // Keep API client aligned with the OAuth-connected store (survives HMR / remounts).
  if (installState.storeId) {
    configureStore({ id: installState.storeId });
  }

  return (
      <div className={`app ${sidebarCollapsed ? 'app--collapsed' : ''} ${mobileNavOpen ? 'app--mobile-open' : ''}`}>
        {/* Mobile top bar — only visible on small screens */}
        <header className="mobile-topbar">
          <button
            className="mobile-topbar__menu"
            aria-label="Open navigation menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <MenuIcon size={22} />
          </button>
          <div className="mobile-topbar__brand">
            <div className="sidebar__brand-logo">
              <img src="/verdant-leaf-logo-green.png" alt="Verdant Leaf" />
            </div>
            <span>FreshTrack</span>
          </div>
          <button
            className="mobile-topbar__notif header-notifications"
            aria-label="Open notifications"
            onClick={() => setIsNotifDrawerOpen(true)}
          >
            <BellIcon size={20} />
            {unseenCount > 0 && (
              <span className="header-notifications-badge">{unseenCount}</span>
            )}
          </button>
        </header>

        {/* Backdrop behind the mobile drawer */}
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />

        {/* Sidebar Navigation */}
        <aside className="sidebar">
          <div className="sidebar__brand">
            <div className="sidebar__brand-left">
              <div className="sidebar__brand-logo">
                <img src="/verdant-leaf-logo-green.png" alt="Verdant Leaf" />
              </div>
              <span className="sidebar__brand-text">FreshTrack</span>
            </div>
            {/* Close button shown only inside the mobile drawer */}
            <button
              className="sidebar__mobile-close"
              aria-label="Close navigation menu"
              onClick={() => setMobileNavOpen(false)}
            >
              <CloseIcon size={22} />
            </button>
          </div>

          <nav className="sidebar__nav">
            <NavLink to={navTo('/')} end className={({isActive}) => `sidebar__link ${isActive ? 'active' : ''}`} title="Dashboard">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              <span>Dashboard</span>
            </NavLink>
            <NavLink to={navTo('/batches')} className={({isActive}) => `sidebar__link ${isActive ? 'active' : ''}`} title="Batches">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              <span>Batches</span>
            </NavLink>
            <NavLink to={navTo('/alerts')} className={({isActive}) => `sidebar__link ${isActive ? 'active' : ''}`} title="Alert Rules">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              <span>Alert Rules</span>
            </NavLink>
            <NavLink to={navTo('/logs')} className={({isActive}) => `sidebar__link ${isActive ? 'active' : ''}`} title="Activity Log">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <span>Activity Log</span>
            </NavLink>
          </nav>

          <div className="sidebar__footer">
            <div className="sidebar__store">
              <div className="sidebar__store-avatar">V</div>
              <div className="sidebar__store-info">
                <div className="sidebar__store-name">Verdant Leaf</div>
                <div className="sidebar__store-url">{storeUrl}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Desktop collapse / expand toggle — attached to the sidebar edge */}
        <button
          className="sidebar-toggle hide-on-mobile"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronLeftIcon size={16} />
        </button>

        {/* Main Content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/batches" element={<BatchManager />} />
            <Route path="/alerts" element={<AlertRules />} />
            <Route path="/logs" element={<ActivityLog />} />
          </Routes>

          {/* Floating notification button - hidden on mobile (mobile uses topbar) */}
          <button
            className="floating-notif-btn hide-on-mobile"
            onClick={() => setIsNotifDrawerOpen(true)}
            aria-label="Open notifications"
          >
            <BellIcon size={20} />
            {unseenCount > 0 && (
              <span className="floating-notif-btn__badge">{unseenCount}</span>
            )}
          </button>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="mobile-bottom-nav">
          <NavLink to={navTo('/')} end className={({isActive}) => `mobile-bottom-nav__item ${isActive ? 'active' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <span>Dashboard</span>
          </NavLink>
          <NavLink to={navTo('/batches')} className={({isActive}) => `mobile-bottom-nav__item ${isActive ? 'active' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            <span>Batches</span>
          </NavLink>
          <NavLink to={navTo('/alerts')} className={({isActive}) => `mobile-bottom-nav__item ${isActive ? 'active' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            <span>Alerts</span>
          </NavLink>
          <NavLink to={navTo('/logs')} className={({isActive}) => `mobile-bottom-nav__item ${isActive ? 'active' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <span>Activity</span>
          </NavLink>
        </nav>

        {/* Notification Drawer Overlay */}
        {isNotifDrawerOpen && (
          <div className="notif-overlay" onClick={() => setIsNotifDrawerOpen(false)} />
        )}
        
        {/* Notification Drawer */}
        <div className={`notif-drawer ${isNotifDrawerOpen ? 'open' : ''}`}>
          <div className="notif-drawer-header">
            <h3>Recent Notifications</h3>
            <button className="btn-close" onClick={() => setIsNotifDrawerOpen(false)}>
              <CloseIcon size={24} />
            </button>
          </div>
          {/* Mark all as read button */}
          {notifications.length > 0 && unseenCount > 0 && (
            <div className="notif-drawer-actions">
              <button className="btn btn--secondary btn--sm" onClick={markAllAsSeen}>
                <CheckCircleIcon size={14} />
                Mark all as read
              </button>
            </div>
          )}
          <div className="notif-drawer-content">
            {notifLoading && notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--ft-text-muted)' }}>Loading…</div>
            ) : notifications.length > 0 ? (
              notifications.map(entry => {
                const { icon, cls } = getActivityMeta(entry);
                const isSeen = seenNotifIds.has(entry.id);
                return (
                  <div 
                    className={`notif-item ${isSeen ? '' : 'unread'}`} 
                    key={entry.id}
                    onClick={() => handleNotifClick(entry)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleNotifClick(entry)}
                  >
                    <div className={`notif-item-icon ${cls}`}>{icon}</div>
                    <div className="notif-item-details">
                      <p>{formatActivityText(entry)}</p>
                      <span>{timeAgo(entry.createdAt)}</span>
                    </div>
                    <div className="notif-item-arrow">›</div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <div className="empty-state__icon"><ClipboardIcon size={32} /></div>
                <div className="empty-state__text">No notifications yet</div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
