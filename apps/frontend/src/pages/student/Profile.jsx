import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header';
import MobileBottomNav from '../../components/layout/MobileBottomNav';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth/authService';
import client from '../../services/api/client';

// Views opened from the profile menu. null = the menu itself.
// Notifications live in the Header bell dropdown (NotificationsDropdown),
// not on this page.
const VIEWS = ['account', 'settings', 'help'];

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

  // ─── Help (disputes) ─────────────────────────────────────────────────────
  const [disputes, setDisputes] = useState([]);

  // Auto-open the view from the URL query param (?view=account, etc.)
  useEffect(() => {
    const view = searchParams.get('view');
    if (view && VIEWS.includes(view)) {
      setActiveView(view);
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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getInitials = (name) => {
    if (!name) return 'SO';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // sara.cruz@example.com -> sa***@example.com (reference-style masking)
  const maskEmail = (email) => {
    if (!email || !email.includes('@')) return email || '—';
    const [local, domain] = email.split('@');
    const visible = local.slice(0, 2);
    return `${visible}${'*'.repeat(3)}@${domain}`;
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
              {profileLoading ? (
                <p style={{ color: 'var(--text-gray)' }}>Loading account…</p>
              ) : (
                <>
                  {/* Identity header — avatar, name, email, status pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', marginBottom: '1.25rem' }}>
                    <div style={{
                      width: 54, height: 54, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--primary)', color: 'var(--white)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '1.15rem',
                    }}>
                      {getInitials(profile?.name || user?.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-dark)', lineHeight: 1.3 }}>
                        {profile?.studentProfile?.fullName || profile?.name || user?.name || '—'}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {profile?.email || user?.email || '—'}
                      </div>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                        marginTop: '0.35rem', padding: '0.15rem 0.6rem',
                        borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
                        color: profile?.status === 'ACTIVE' ? '#065f46' : '#b10035',
                        background: profile?.status === 'ACTIVE' ? '#d1fae5' : '#fde8ec',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: profile?.status === 'ACTIVE' ? '#10b981' : '#b10035' }} />
                        {profile?.status === 'ACTIVE' ? 'Active account' : (profile?.status || 'Unknown')}
                      </span>
                    </div>
                  </div>

                  {/* College details — 2-column field grid */}
                  {profile?.studentProfile ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.25rem' }}>
                      {[
                        { label: 'College ID', value: profile.studentProfile.collegeId },
                        { label: 'Course', value: profile.studentProfile.course },
                        { label: 'Year', value: profile.studentProfile.year },
                        { label: 'Phone', value: profile.studentProfile.phone },
                      ].map((f) => (
                        <div key={f.label} style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: '0.65rem 0.8rem', minWidth: 0 }}>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.2rem' }}>{f.label}</div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-dark)', wordBreak: 'break-word' }}>{f.value || '—'}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ border: '1px dashed var(--border-color)', borderRadius: 10, padding: '0.9rem 1rem', marginBottom: '1.25rem', fontSize: '0.88rem', color: 'var(--text-gray)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <span>College details (ID, course, year) aren't filled in yet.</span>
                      <button onClick={() => navigate('/student/onboarding')} style={{ flexShrink: 0, padding: '0.4rem 0.8rem', border: 'none', borderRadius: 8, background: 'var(--primary)', color: 'var(--white)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                        Complete
                      </button>
                    </div>
                  )}

                  {/* Display name editor */}
                  <label style={{ ...panelLabel, display: 'block', marginBottom: '0.2rem' }}>Display name</label>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-gray)', margin: '0 0 0.5rem 0' }}>
                    Shown to outlets on your orders and on your reviews.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder="Your name"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: '0.65rem 0.85rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                      }}
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName || !nameDraft.trim() || nameDraft.trim() === (profile?.name || user?.name || '')}
                      style={{
                        padding: '0.65rem 1.1rem',
                        border: 'none',
                        borderRadius: '8px',
                        background: 'var(--primary)',
                        color: 'var(--white)',
                        fontWeight: 600,
                        opacity: savingName || !nameDraft.trim() || nameDraft.trim() === (profile?.name || user?.name || '') ? 0.5 : 1,
                        cursor: savingName ? 'wait' : 'pointer',
                      }}
                    >
                      {savingName ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                  {nameMessage && (
                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: nameMessage.ok ? '#10b981' : '#b10035' }}>
                      {nameMessage.ok ? '✓ ' : '✕ '}{nameMessage.text}
                    </p>
                  )}
                </>
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
        {!activeView && (
        <div
          className="profile-header-card"
          onClick={() => openView('account')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') openView('account'); }}
        >
          <div className="profile-avatar-large">
            {getInitials(user?.name)}
          </div>
          <div className="profile-info-details">
            <h2 className="profile-name">{user?.name || 'Student One'}</h2>
            <p className="profile-email">{maskEmail(user?.email) || 'student@example.com'}</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--text-gray)', flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
        )}

        {!activeView && (
          <div className="profile-menu-section">
            <ul className="profile-menu-list">
              <li>
                <button className="profile-menu-btn" onClick={() => openView('account')}>
                  <span className="profile-menu-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </span>
                  <span className="profile-menu-label">Account details</span>
                  <svg className="profile-menu-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </li>
              <li>
                <button className="profile-menu-btn" onClick={() => navigate('/student/orders')}>
                  <span className="profile-menu-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                  </span>
                  <span className="profile-menu-label">My Orders</span>
                  <svg className="profile-menu-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </li>
              <li>
                <button className="profile-menu-btn" onClick={() => openView('settings')}>
                  <span className="profile-menu-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  </span>
                  <span className="profile-menu-label">Settings</span>
                  <svg className="profile-menu-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </li>
              <li>
                <button className="profile-menu-btn" onClick={() => openView('help')}>
                  <span className="profile-menu-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  </span>
                  <span className="profile-menu-label">Help & support</span>
                  <svg className="profile-menu-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </li>
              <li>
                <button className="profile-menu-btn text-danger" onClick={handleLogout}>
                  <span className="profile-menu-icon danger">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  </span>
                  <span className="profile-menu-label">Logout</span>
                  <svg className="profile-menu-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
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
