import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header';
import MobileBottomNav from '../../components/layout/MobileBottomNav';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth/authService';
import { notificationService } from '../../services/api/notificationService';

// Views opened from the profile menu. null = the menu itself.
const VIEWS = ['account', 'notifications', 'settings', 'help'];

const formatTime = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
};

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuth();

  const [activeView, setActiveView] = useState(null);
  const [searchParams] = useSearchParams();

  // ─── Account ────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState(null);

  // ─── Notifications ──────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [disputes, setDisputes] = useState([]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationService.list({ unread: true, pageSize: 1 });
      setUnreadCount(res.data?.unreadCount ?? res.data?.total ?? 0);
    } catch {
      // badge is decorative — ignore fetch failures here
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Auto-open the view from the URL query param (?view=notifications, etc.)
  // This lets the notification bell navigate to /student/profile?view=notifications
  // and the Profile page auto-opens the notifications panel.
  useEffect(() => {
    const view = searchParams.get('view');
    if (view && VIEWS.includes(view)) {
      setActiveView(view);
      if (view === 'notifications') fetchNotifications();
    if (view === 'help') fetchDisputes();
      if (view === 'account') fetchProfile();
    }
  }, [searchParams]);

  const fetchDisputes = async () => {
    try {
      const res = await client.get('/disputes/mine');
      setDisputes(res.data?.data || []);
    } catch {}
  };

  const openView = (view) => {
    setActiveView(view);
    if (view === 'account') fetchProfile();
    if (view === 'notifications') fetchNotifications();
    if (view === 'help') fetchDisputes();
  };

  const fetchProfile = async () => {
    try {
      setProfileLoading(true);
      const res = await authService.getProfile();
      setProfile(res.data?.user || null);
      setNameDraft(res.data?.user?.name || '');
      setNameMessage(null);
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      setNotifLoading(true);
      setNotifError(null);
      const res = await notificationService.list({ pageSize: 30 });
      setNotifications(res.data?.items || []);
      setUnreadCount(res.data?.unreadCount ?? 0);
    } catch (err) {
      setNotifError(err.message || 'Failed to load notifications');
    } finally {
      setNotifLoading(false);
    }
  };

  const handleSaveName = async () => {
    const name = nameDraft.trim();
    if (!name) {
      setNameMessage({ ok: false, text: 'Name cannot be empty' });
      return;
    }
    try {
      setSavingName(true);
      const updated = await updateProfile({ name });
      if (updated) {
        setProfile((p) => ({ ...(p || {}), name: updated.name }));
        setNameMessage({ ok: true, text: 'Name updated' });
      }
    } catch (err) {
      setNameMessage({ ok: false, text: err.message || 'Could not update name' });
    } finally {
      setSavingName(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await notificationService.markAllRead();
      setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      alert(err.message || 'Could not mark notifications as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkOneRead = async (n) => {
    if (n.isRead) return;
    try {
      await notificationService.markRead(n.id);
      setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getInitials = (name) => {
    if (!name) return 'SO';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // ─── Shared panel styles (same visual language as the menu card) ───────
  const panelCard = {
    background: 'var(--white)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    overflow: 'hidden',
  };
  const panelRow = {
    padding: '1rem 1.25rem',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  };
  const panelLabel = {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-gray)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  };
  const panelValue = {
    fontSize: '1rem',
    fontWeight: 500,
    color: 'var(--text-dark)',
    textAlign: 'right',
  };
  const backBtn = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem 1.25rem',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid var(--border-color)',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--primary)',
    cursor: 'pointer',
    textAlign: 'left',
  };
  const panelTitle = {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--text-dark)',
    margin: '0 0 0.75rem 0',
  };
  const panelIntro = {
    fontSize: '0.9rem',
    color: 'var(--text-gray)',
    margin: '0 0 1rem 0',
    lineHeight: 1.5,
  };

  const renderPanel = () => {
    if (!activeView) return null;

    return (
      <div className="profile-menu-section" style={{ paddingTop: 0 }}>
        <div style={panelCard}>
          <button style={backBtn} onClick={() => setActiveView(null)}>
            ← Back to profile
          </button>

          {/* ─── ACCOUNT ─── */}
          {activeView === 'account' && (
            <div style={{ padding: '1.25rem' }}>
              <h3 style={panelTitle}>Account</h3>
              <p style={panelIntro}>Your college account details, fetched live from your sign-in.</p>
              {profileLoading ? (
                <p style={{ color: 'var(--text-gray)' }}>Loading account…</p>
              ) : (
                <>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.25rem' }}>
                    <div style={panelRow}>
                      <span style={panelLabel}>Full name</span>
                      <span style={panelValue}>{profile?.studentProfile?.fullName || profile?.name || user?.name || '—'}</span>
                    </div>
                    <div style={panelRow}>
                      <span style={panelLabel}>College email</span>
                      <span style={panelValue}>{profile?.email || user?.email || '—'}</span>
                    </div>
                    {profile?.studentProfile && (
                      <>
                        <div style={panelRow}>
                          <span style={panelLabel}>College ID</span>
                          <span style={panelValue}>{profile.studentProfile.collegeId || '—'}</span>
                        </div>
                        <div style={panelRow}>
                          <span style={panelLabel}>Course</span>
                          <span style={panelValue}>{profile.studentProfile.course || '—'}</span>
                        </div>
                        <div style={panelRow}>
                          <span style={panelLabel}>Year</span>
                          <span style={panelValue}>{profile.studentProfile.year || '—'}</span>
                        </div>
                        <div style={panelRow}>
                          <span style={panelLabel}>Phone</span>
                          <span style={panelValue}>{profile.studentProfile.phone || '—'}</span>
                        </div>
                      </>
                    )}
                    <div style={{ ...panelRow, borderBottom: 'none' }}>
                      <span style={panelLabel}>Account status</span>
                      <span style={{ ...panelValue, color: profile?.status === 'ACTIVE' ? '#10b981' : '#b10035', fontWeight: 700 }}>
                        {profile?.status || 'ACTIVE'}
                      </span>
                    </div>
                  </div>

                  <label style={{ ...panelLabel, display: 'block', marginBottom: '0.4rem' }}>Display name</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder="Your name"
                      style={{
                        flex: 1,
                        padding: '0.65rem 0.85rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                      }}
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName}
                      style={{
                        padding: '0.65rem 1.1rem',
                        border: 'none',
                        borderRadius: '8px',
                        background: 'var(--primary)',
                        color: 'var(--white)',
                        fontWeight: 600,
                        cursor: savingName ? 'wait' : 'pointer',
                      }}
                    >
                      {savingName ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                  {nameMessage && (
                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: nameMessage.ok ? '#10b981' : '#b10035' }}>
                      {nameMessage.text}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── NOTIFICATIONS ─── */}
          {activeView === 'notifications' && (
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ ...panelTitle, marginBottom: 0 }}>Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={markingAll}
                    style={{
                      padding: '0.4rem 0.85rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '20px',
                      background: 'var(--white)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--primary)',
                      cursor: markingAll ? 'wait' : 'pointer',
                    }}
                  >
                    {markingAll ? 'Marking…' : `Mark all read (${unreadCount})`}
                  </button>
                )}
              </div>
              <p style={panelIntro}>Order updates from outlets — accepted, preparing, ready for pickup.</p>
              {notifLoading ? (
                <p style={{ color: 'var(--text-gray)' }}>Loading notifications…</p>
              ) : notifError ? (
                <p style={{ color: '#b10035' }}>{notifError}</p>
              ) : notifications.length === 0 ? (
                <p style={{ color: 'var(--text-gray)' }}>No notifications yet. Place an order and updates will appear here.</p>
              ) : (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                  {notifications.map((n, idx) => (
                    <button
                      key={n.id}
                      onClick={() => handleMarkOneRead(n)}
                      style={{
                        display: 'flex',
                        gap: '0.75rem',
                        width: '100%',
                        textAlign: 'left',
                        padding: '1rem 1.25rem',
                        background: n.isRead ? 'var(--white)' : '#fdf5f7',
                        border: 'none',
                        borderBottom: idx !== notifications.length - 1 ? '1px solid var(--border-color)' : 'none',
                        cursor: n.isRead ? 'default' : 'pointer',
                      }}
                    >
                      <span
                        style={{
                          marginTop: '0.4rem',
                          width: 8,
                          height: 8,
                          minWidth: 8,
                          borderRadius: '50%',
                          background: n.isRead ? 'transparent' : 'var(--primary)',
                        }}
                      />
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontWeight: n.isRead ? 500 : 700, color: 'var(--text-dark)', fontSize: '0.95rem' }}>
                          {n.title}
                        </span>
                        <span style={{ display: 'block', color: 'var(--text-gray)', fontSize: '0.88rem', marginTop: '0.15rem', lineHeight: 1.4 }}>
                          {n.message}
                        </span>
                        <span style={{ display: 'block', color: 'var(--text-light, #9ca3af)', fontSize: '0.78rem', marginTop: '0.35rem' }}>
                          {formatTime(n.createdAt)}
                          {!n.isRead && ' · tap to mark read'}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── SETTINGS ─── */}
          {activeView === 'settings' && (
            <div style={{ padding: '1.25rem' }}>
              <h3 style={panelTitle}>Settings</h3>
              <p style={panelIntro}>Session details for this device.</p>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.25rem' }}>
                <div style={panelRow}>
                  <span style={panelLabel}>Signed in as</span>
                  <span style={panelValue}>{user?.email || '—'}</span>
                </div>
                <div style={panelRow}>
                  <span style={panelLabel}>Role</span>
                  <span style={panelValue}>Student</span>
                </div>
                <div style={{ ...panelRow, borderBottom: 'none' }}>
                  <span style={panelLabel}>Account status</span>
                  <span style={panelValue}>{profile?.status || user?.status || 'ACTIVE'}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  background: 'var(--white)',
                  color: '#ef4444',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                }}
              >
                Log out of this device
              </button>
            </div>
          )}

          {/* ─── HELP ─── */}
          {activeView === 'help' && (
            <div style={{ padding: '1.25rem' }}>
              <h3 style={panelTitle}>Help</h3>
              <p style={panelIntro}>How ordering on Nosh works:</p>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
                  <strong style={{ color: 'var(--text-dark)' }}>1. Order</strong>
                  <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-gray)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    Pick an outlet, add items to your cart and place the order before the outlet closes.
                  </p>
                </div>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
                  <strong style={{ color: 'var(--text-dark)' }}>2. Wait for status updates</strong>
                  <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-gray)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    You'll get a notification when the outlet accepts and starts preparing your food.
                  </p>
                </div>
                <div style={{ padding: '1rem 1.25rem' }}>
                  <strong style={{ color: 'var(--text-dark)' }}>3. Pick up with your code</strong>
                  <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-gray)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    When your order is Ready, show the 4-digit pickup code from your order to the outlet staff. Orders not collected in time are cancelled automatically.
                  </p>
                </div>
              </div>
              {/* Disputes list */}
              {disputes.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Your reported issues</h4>
                  {disputes.map(d => (
                    <div key={d.id} style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '10px', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{d.type.replace(/_/g, ' ')}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '10px',
                          background: d.status === 'OPEN' ? '#fef3c7' : d.status === 'RESOLVED' ? '#d1fae5' : '#fee2e2',
                          color: d.status === 'OPEN' ? '#92400e' : d.status === 'RESOLVED' ? '#065f46' : '#991b1b' }}>
                          {d.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-gray)', margin: 0 }}>{d.description}</p>
                      {d.resolution && <p style={{ fontSize: '0.8rem', color: '#065f46', marginTop: '0.25rem' }}>✓ {d.resolution}</p>}
                    </div>
                  ))}
                </div>
              )}

              <p style={{ ...panelIntro, marginTop: '1rem', marginBottom: 0 }}>
                For order or payment issues, report from your order history or contact campus administration.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page-wrapper bg-white">
      <Header title="Profile" showBack={false} />

      <main className="explore-container profile-container">
        <div className="profile-header-card">
          <div className="profile-avatar-large">
            {getInitials(user?.name)}
          </div>
          <div className="profile-info-details">
            <h2 className="profile-name">{user?.name || 'Student One'}</h2>
            <p className="profile-email">{user?.email || 'student@example.com'}</p>
          </div>
        </div>

        {!activeView && (
          <div className="profile-menu-section">
            <ul className="profile-menu-list">
              <li>
                <button className="profile-menu-btn" onClick={() => openView('account')}>
                  <span>Account</span>
                  <span className="arrow-icon">→</span>
                </button>
              </li>
              <li>
                <button className="profile-menu-btn" onClick={() => openView('notifications')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Notifications
                    {unreadCount > 0 && (
                      <span style={{
                        background: 'var(--primary)',
                        color: 'var(--white)',
                        borderRadius: '999px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.5rem',
                      }}>
                        {unreadCount}
                      </span>
                    )}
                  </span>
                  <span className="arrow-icon">→</span>
                </button>
              </li>
              <li>
                <button className="profile-menu-btn" onClick={() => openView('settings')}>
                  <span>Settings</span>
                  <span className="arrow-icon">→</span>
                </button>
              </li>
              <li>
                <button className="profile-menu-btn" onClick={() => openView('help')}>
                  <span>Help</span>
                  <span className="arrow-icon">→</span>
                </button>
              </li>
              <li>
                <button className="profile-menu-btn text-danger" onClick={handleLogout}>
                  <span>Logout</span>
                  <span className="arrow-icon">→</span>
                </button>
              </li>
            </ul>
          </div>
        )}

        {renderPanel()}
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default Profile;
