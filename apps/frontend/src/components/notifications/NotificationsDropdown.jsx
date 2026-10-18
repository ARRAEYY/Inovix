import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { notificationService } from '../../services/api/notificationService';
import { cacheGet, cacheSet } from '../../services/cache/localCache';

// NotificationsDropdown — bell button + dropdown panel. Replaces the old
// flow that navigated to /student/profile?view=notifications: order updates
// open right here under the bell instead of on a separate page view.
//
// Loading strategy (stale-while-revalidate): the panel and the unread badge
// render instantly from the localStorage cache of the last fetch, then
// refresh in the background. If the cached list is fresh (<15s) the network
// is skipped entirely. The badge also refetches every 30s and on
// 'nosh:notification' window events (dispatched by SocketContext when
// 'notification:created' arrives). Only students see the bell — outlet
// staff get notifications via the outlet dashboard, not the Header.

const UNREAD_POLL_MS = 30000; // background badge refresh
const LIST_FRESH_MS = 15000;  // skip refetch if the cached list is newer than this
const LIST_MAX_AGE_MS = 5 * 60 * 1000; // render cached list up to this age

const formatTime = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
};

const NotificationsDropdown = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const unreadKey = user ? `notif:${user.id}:unread` : null;
  const listKey = user ? `notif:${user.id}:list` : null;

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const wrapRef = useRef(null);
  const openRef = useRef(false);

  const fetchUnread = useCallback(async () => {
    if (!unreadKey) return;
    try {
      const res = await notificationService.list({ unread: true, pageSize: 1 });
      const count = res.data?.unreadCount ?? res.data?.total ?? 0;
      setUnreadCount(count);
      cacheSet(unreadKey, count);
    } catch { /* badge is decorative — ignore */ }
  }, [unreadKey]);

  const fetchList = useCallback(async ({ force = false } = {}) => {
    if (!listKey) return;
    // Fresh enough — render from cache and skip the network.
    const fresh = cacheGet(listKey, LIST_FRESH_MS);
    if (!force && fresh) {
      setItems(fresh);
      return;
    }
    // Stale but renderable — show it now, refresh underneath (no spinner).
    const stale = cacheGet(listKey, LIST_MAX_AGE_MS);
    if (stale) setItems(stale);
    else setLoading(true);
    try {
      const res = await notificationService.list({ pageSize: 20 });
      const nextItems = res.data?.items || [];
      const nextUnread = res.data?.unreadCount ?? 0;
      setItems(nextItems);
      setUnreadCount(nextUnread);
      setError(null);
      cacheSet(listKey, nextItems);
      cacheSet(unreadKey, nextUnread);
    } catch (err) {
      // Only surface the error when we had nothing to show at all.
      if (!stale) setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [listKey, unreadKey]);

  // Hydrate instantly from the previous session's cache.
  useEffect(() => {
    if (!isStudent || !unreadKey || !listKey) return;
    const cachedUnread = cacheGet(unreadKey, LIST_MAX_AGE_MS);
    if (cachedUnread !== null) setUnreadCount(cachedUnread);
    const cachedItems = cacheGet(listKey, LIST_MAX_AGE_MS);
    if (cachedItems) setItems(cachedItems);
  }, [isStudent, unreadKey, listKey]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Badge refresh: initial + poll + realtime socket events
  useEffect(() => {
    if (!isStudent) return;
    let active = true;
    fetchUnread();
    const interval = setInterval(fetchUnread, UNREAD_POLL_MS);
    const onNotification = () => {
      if (!active) return;
      fetchUnread();
      if (openRef.current) fetchList({ force: true });
    };
    window.addEventListener('nosh:notification', onNotification);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('nosh:notification', onNotification);
    };
  }, [isStudent, fetchUnread, fetchList]);

  // Close on outside click or Escape
  useEffect(() => {
    const onDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!isStudent) return null;

  const toggle = () => {
    const next = !open;
    if (next) fetchList();
    setOpen(next);
  };

  const applyItems = (nextItems, nextUnread) => {
    setItems(nextItems);
    setUnreadCount(nextUnread);
    cacheSet(listKey, nextItems);
    cacheSet(unreadKey, nextUnread);
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await notificationService.markAllRead();
      applyItems(items.map((n) => ({ ...n, isRead: true })), 0);
    } catch (err) {
      setError(err.message || 'Could not mark notifications as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkOneRead = async (n) => {
    if (!n.isRead) {
      try {
        await notificationService.markRead(n.id);
        const nextItems = items.map((x) => (x.id === n.id ? { ...x, isRead: true } : x));
        applyItems(nextItems, Math.max(0, unreadCount - 1));
      } catch { /* keep the unread dot — it will retry next refresh */ }
    }
    setOpen(false);
    navigate('/student/orders');
  };

  return (
    <div ref={wrapRef} className="notif-dropdown-wrapper">
      <button
        onClick={toggle}
        aria-label="Notifications"
        aria-expanded={open}
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: '#b10035', color: 'white',
            borderRadius: '999px', fontSize: '0.65rem',
            fontWeight: 700, minWidth: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="notif-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="Notifications"
            className="notif-dropdown-panel"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)', background: '#fafafa' }}>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-dark)', fontWeight: 700 }}>Notifications</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={markingAll}
                    style={{
                      padding: '0.3rem 0.75rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: 20,
                      background: 'var(--white)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--primary)',
                      cursor: markingAll ? 'wait' : 'pointer',
                    }}
                  >
                    {markingAll ? 'Marking…' : `Mark all read (${unreadCount})`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close notifications"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    color: 'var(--text-gray)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>

            <div style={{ maxHeight: 'min(420px, calc(100vh - 160px))', overflowY: 'auto' }}>
              {loading ? (
                <p style={{ color: 'var(--text-gray)', padding: '1.25rem', textAlign: 'center', fontSize: '0.9rem' }}>Loading notifications…</p>
              ) : error ? (
                <p style={{ color: '#b10035', padding: '1.25rem', fontSize: '0.88rem', textAlign: 'center' }}>{error}</p>
              ) : items.length === 0 ? (
                <div style={{ padding: '2rem 1.25rem', textAlign: 'center', color: 'var(--text-gray)' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 0.75rem', opacity: 0.5 }}>
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-dark)' }}>No notifications yet</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-gray)' }}>Order updates and announcements will appear here.</p>
                </div>
              ) : (
                items.map((n, idx) => (
                  <button
                    key={n.id}
                    onClick={() => handleMarkOneRead(n)}
                    className="notif-item"
                    style={{
                      background: n.isRead ? 'var(--white)' : '#fdf5f7',
                      borderBottom: idx !== items.length - 1 ? '1px solid var(--border-color)' : 'none',
                    }}
                  >
                    <span style={{
                      marginTop: '0.4rem',
                      width: 8,
                      height: 8,
                      minWidth: 8,
                      borderRadius: '50%',
                      background: n.isRead ? 'transparent' : 'var(--primary)',
                    }} />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: n.isRead ? 600 : 700, color: 'var(--text-dark)', fontSize: '0.9rem' }}>
                        {n.title}
                      </span>
                      <span style={{ display: 'block', color: 'var(--text-gray)', fontSize: '0.85rem', marginTop: '0.2rem', lineHeight: 1.4 }}>
                        {n.message}
                      </span>
                      <span style={{ display: 'block', color: 'var(--text-light, #9ca3af)', fontSize: '0.75rem', marginTop: '0.35rem' }}>
                        {formatTime(n.createdAt)}
                        {!n.isRead && ' · tap to view order'}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationsDropdown;
