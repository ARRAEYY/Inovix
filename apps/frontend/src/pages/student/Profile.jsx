import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';

/* ── Mock orders ──────────────────────────────────────────────── */
const MOCK_ORDERS = [
  {
    id: 'ORD-1234',
    outletName: 'The Courtyard Café',
    date: 'Today, 2:30 PM',
    items: [
      { name: 'Cold Coffee', quantity: 1, price: 120 },
      { name: 'Grilled Sandwich', quantity: 1, price: 150 },
    ],
    total: 270,
    status: 'Delivered',
  },
  {
    id: 'ORD-1235',
    outletName: 'Dosa District',
    date: 'Yesterday, 8:15 PM',
    items: [
      { name: 'Masala Dosa', quantity: 2, price: 180 },
      { name: 'Filter Coffee', quantity: 2, price: 80 },
    ],
    total: 260,
    status: 'Delivered',
  },
  {
    id: 'ORD-1236',
    outletName: 'Campus Thali Co.',
    date: '5 days ago, 1:00 PM',
    items: [{ name: 'Special North Thali', quantity: 1, price: 200 }],
    total: 200,
    status: 'Delivered',
  },
];

/* ── Helpers ───────────────────────────────────────────────────── */
const getInitials = (name) => {
  if (!name) return 'S';
  return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
};

/* ── Eye icon ─────────────────────────────────────────────────── */
const EyeIcon = ({ visible }) =>
  visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

/* ══════════════════════════════════════════════════════════════ */
const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('account');

  const handleMenuClick = (key) => {
    if (key === 'logout') { logout(); return; }
    if (key === 'settings' || key === 'help') {
      alert(`"${key.charAt(0).toUpperCase() + key.slice(1)}" coming soon!`);
      return;
    }
    setActiveSection(key);
  };

  /* ── Menu items ── */
  const MENU_ITEMS = [
    {
      key: 'account',
      label: 'Account',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      key: 'orders',
      label: 'Your Orders',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      ),
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
    {
      key: 'help',
      label: 'Help',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
  ];

  /* ── Mobile bottom nav tabs (Account, Orders, Settings, Help) ── */
  const BOTTOM_TABS = [
    {
      key: 'account',
      label: 'Account',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      key: 'orders',
      label: 'Orders',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      ),
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
    {
      key: 'help',
      label: 'Help',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
  ];

  return (
    <div className="page-wrapper">
      <Header />
      <main className="explore-container profile-page-main">
        <div className="page-header profile-page-header">
          <h1 className="page-title">Your Profile</h1>
          <p className="page-subtitle">Manage your account and preferences</p>
        </div>

        <div className="profile-layout">
          {/* ── LEFT SIDEBAR — desktop only ── */}
          <aside className="profile-sidebar">
            {/* Identity card */}
            <div className="profile-identity-card">
              <div className="profile-avatar-lg">{getInitials(user?.name)}</div>
              <div className="profile-identity-info">
                <p className="profile-display-name">{user?.name || 'Student'}</p>
                <p className="profile-display-email">{user?.email || 'student@rishihood.edu.in'}</p>
              </div>
            </div>

            {/* Navigation menu */}
            <nav className="profile-menu-card">
              {MENU_ITEMS.map((item) => (
                <button
                  key={item.key}
                  className={`profile-menu-item ${activeSection === item.key ? 'active' : ''}`}
                  onClick={() => handleMenuClick(item.key)}
                >
                  <span className="profile-menu-icon">{item.icon}</span>
                  <span className="profile-menu-label">{item.label}</span>
                  <svg className="profile-menu-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}

              <div className="profile-menu-divider" />

              {/* Logout */}
              <button className="profile-menu-item profile-menu-logout" onClick={() => handleMenuClick('logout')}>
                <span className="profile-menu-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </span>
                <span className="profile-menu-label">Logout</span>
                <svg className="profile-menu-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </nav>
          </aside>

          {/* ── RIGHT PANEL ── */}
          <section className="profile-right-panel">
            {activeSection === 'account' && <AccountPanel user={user} />}
            {activeSection === 'orders'  && <OrdersPanel navigate={navigate} />}
          </section>
        </div>
      </main>

      {/* ── MOBILE BOTTOM NAV — hidden on desktop ── */}
      <nav className="profile-mobile-nav" aria-label="Profile navigation">
        {BOTTOM_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`profile-mobile-tab ${activeSection === tab.key ? 'active' : ''}`}
            onClick={() => handleMenuClick(tab.key)}
            aria-label={tab.label}
          >
            <span className="profile-mobile-tab-icon">{tab.icon}</span>
            <span className="profile-mobile-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   Account Panel
   ══════════════════════════════════════════════════════════════ */
const AccountPanel = ({ user }) => {
  const [phoneStep, setPhoneStep]     = useState('idle');
  const [newPhone, setNewPhone]       = useState('');
  const [otp, setOtp]                 = useState('');
  const [phoneError, setPhoneError]   = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const [pwStep, setPwStep]           = useState('idle');
  const [pwForm, setPwForm]           = useState({ current: '', newPw: '', confirm: '' });
  const [pwShow, setPwShow]           = useState({ current: false, newPw: false, confirm: false });
  const [pwError, setPwError]         = useState('');
  const [pwSuccess, setPwSuccess]     = useState('');
  const [pwLoading, setPwLoading]     = useState(false);

  const startCountdown = () => {
    setResendTimer(30);
    const id = setInterval(() => {
      setResendTimer((t) => { if (t <= 1) { clearInterval(id); return 0; } return t - 1; });
    }, 1000);
  };

  const handleSendOtp = (e) => {
    e.preventDefault();
    setPhoneError('');
    if (!/^\d{10}$/.test(newPhone.trim())) { setPhoneError('Enter a valid 10-digit phone number.'); return; }
    setPhoneLoading(true);
    setTimeout(() => { setPhoneLoading(false); setPhoneStep('otp'); startCountdown(); }, 1000);
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    setPhoneError('');
    if (otp.length !== 6) { setPhoneError('Enter the 6-digit OTP.'); return; }
    setPhoneLoading(true);
    setTimeout(() => {
      setPhoneLoading(false);
      setPhoneStep('done');
      setPhoneSuccess(`Phone number updated to +91\u00a0${newPhone}.`);
    }, 1200);
  };

  const resetPhone = () => { setPhoneStep('idle'); setNewPhone(''); setOtp(''); setPhoneError(''); setPhoneSuccess(''); };

  const handlePwField = (e) => { setPwForm({ ...pwForm, [e.target.name]: e.target.value }); setPwError(''); setPwSuccess(''); };
  const togglePwShow  = (f)  => setPwShow((s) => ({ ...s, [f]: !s[f] }));

  const handlePwSubmit = (e) => {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (!pwForm.current) { setPwError('Please enter your current password.'); return; }
    if (pwForm.newPw.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError('Passwords do not match.'); return; }
    setPwLoading(true);
    setTimeout(() => {
      setPwLoading(false);
      setPwSuccess('Password updated successfully!');
      setPwForm({ current: '', newPw: '', confirm: '' });
      setPwStep('idle');
    }, 1200);
  };

  const resetPw = () => { setPwStep('idle'); setPwForm({ current: '', newPw: '', confirm: '' }); setPwError(''); setPwSuccess(''); };

  const ReadOnlyField = ({ label, value }) => (
    <div className="acct-field">
      <label className="acct-field-label">{label}</label>
      <div className="acct-field-value-row acct-field-value-row--static">
        <span className="acct-field-value">{value || '—'}</span>
      </div>
    </div>
  );

  return (
    <div className="account-details-panel">
      {/* ── Card 1: Account Details ─────────────────────────────── */}
      <div className="acct-section-card">
        <div className="acct-section-header">
          <h2 className="profile-section-title">Account Details</h2>
        </div>

        <div className="acct-fields-grid">
          <ReadOnlyField label="Full Name"         value={user?.name} />
          <ReadOnlyField label="College Email"     value={user?.email} />
          <ReadOnlyField label="Enrollment Number" value={user?.enrollmentNumber || 'RU2024XXXX'} />

          <div className="acct-field">
            <label className="acct-field-label">Phone Number</label>
            <div className="acct-field-value-row">
              <span className="acct-field-value">{user?.phone || '+91 XXXXXXXXXX'}</span>
              {phoneStep === 'idle' && (
                <button className="acct-edit-btn" onClick={() => setPhoneStep('input')}>Change</button>
              )}
            </div>
          </div>

          <div className="acct-field">
            <label className="acct-field-label">Password</label>
            <div className="acct-field-value-row">
              <span className="acct-field-value">••••••••</span>
              {pwStep === 'idle' && (
                <button className="acct-edit-btn" onClick={() => setPwStep('form')}>Change</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Card 2: Change Phone (conditional) ─────────────────── */}
      {phoneStep !== 'idle' && (
        <div className="acct-section-card">
          <div className="acct-section-header">
            <h2 className="acct-subsection-title">Change Phone Number</h2>
            <p className="acct-section-subtitle">
              {phoneStep === 'input' && 'Enter your new phone number to receive an OTP.'}
              {phoneStep === 'otp'   && `OTP sent to +91\u00a0${newPhone}. Enter it below.`}
              {phoneStep === 'done'  && 'Your phone number has been updated.'}
            </p>
          </div>

          {phoneSuccess && <div className="acct-alert acct-alert-success">{phoneSuccess}</div>}
          {phoneError   && <div className="acct-alert acct-alert-error">{phoneError}</div>}

          {phoneStep === 'input' && (
            <form className="acct-form" onSubmit={handleSendOtp}>
              <div className="acct-form-field">
                <label className="acct-form-label">New Phone Number</label>
                <div className="acct-input-prefix-wrap">
                  <span className="acct-input-prefix">+91</span>
                  <input
                    type="tel"
                    className="acct-input acct-input-prefixed"
                    placeholder="10-digit number"
                    maxLength={10}
                    value={newPhone}
                    onChange={(e) => { setNewPhone(e.target.value.replace(/\D/g, '')); setPhoneError(''); }}
                  />
                </div>
              </div>
              <div className="acct-form-actions">
                <button type="submit" className="acct-primary-btn" disabled={phoneLoading}>
                  {phoneLoading
                    ? <span className="btn-loading-content"><span className="btn-spinner" />Sending OTP…</span>
                    : 'Send OTP'}
                </button>
                <button type="button" className="acct-ghost-btn" onClick={resetPhone}>Cancel</button>
              </div>
            </form>
          )}

          {phoneStep === 'otp' && (
            <form className="acct-form" onSubmit={handleVerifyOtp}>
              <div className="acct-form-field">
                <label className="acct-form-label">Enter OTP</label>
                <input
                  type="text"
                  className="acct-input acct-input-otp"
                  placeholder="6-digit OTP"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setPhoneError(''); }}
                />
                <p className="acct-otp-hint">
                  {resendTimer > 0
                    ? `Resend OTP in ${resendTimer}s`
                    : <button type="button" className="acct-link-btn" onClick={startCountdown}>Resend OTP</button>}
                </p>
              </div>
              <div className="acct-form-actions">
                <button type="submit" className="acct-primary-btn" disabled={phoneLoading}>
                  {phoneLoading
                    ? <span className="btn-loading-content"><span className="btn-spinner" />Verifying…</span>
                    : 'Verify & Update'}
                </button>
                <button type="button" className="acct-ghost-btn" onClick={resetPhone}>Cancel</button>
              </div>
            </form>
          )}

          {phoneStep === 'done' && (
            <button className="acct-ghost-btn" onClick={resetPhone}>Done</button>
          )}
        </div>
      )}

      {/* ── Card 3: Change Password (conditional) ──────────────── */}
      {pwStep === 'form' && (
        <div className="acct-section-card">
          <div className="acct-section-header">
            <h2 className="acct-subsection-title">Change Password</h2>
            <p className="acct-section-subtitle">Keep your account secure with a strong password.</p>
          </div>

          {pwSuccess && <div className="acct-alert acct-alert-success">{pwSuccess}</div>}
          {pwError   && <div className="acct-alert acct-alert-error">{pwError}</div>}

          <form className="acct-form" onSubmit={handlePwSubmit}>
            {[
              { name: 'current', label: 'Current Password',  placeholder: 'Enter current password',  ac: 'current-password' },
              { name: 'newPw',   label: 'New Password',       placeholder: 'Min. 8 characters',       ac: 'new-password' },
              { name: 'confirm', label: 'Confirm Password',   placeholder: 'Re-enter new password',   ac: 'new-password' },
            ].map(({ name, label, placeholder, ac }) => (
              <div className="acct-form-field" key={name}>
                <label className="acct-form-label">{label}</label>
                <div className="acct-pw-wrap">
                  <input
                    type={pwShow[name] ? 'text' : 'password'}
                    name={name}
                    className="acct-input"
                    placeholder={placeholder}
                    value={pwForm[name]}
                    onChange={handlePwField}
                    autoComplete={ac}
                  />
                  <button type="button" className="acct-pw-toggle" onClick={() => togglePwShow(name)}>
                    <EyeIcon visible={pwShow[name]} />
                  </button>
                </div>
              </div>
            ))}

            <div className="acct-form-actions">
              <button type="submit" className="acct-primary-btn" disabled={pwLoading}>
                {pwLoading
                  ? <span className="btn-loading-content"><span className="btn-spinner" />Updating…</span>
                  : 'Update Password'}
              </button>
              <button type="button" className="acct-ghost-btn" onClick={resetPw}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   Orders Panel
   ══════════════════════════════════════════════════════════════ */
const OrdersPanel = ({ navigate }) => (
  <div className="account-details-panel">
    <div className="acct-section-card">
      <div className="acct-section-header acct-orders-header-row">
        <div>
          <h2 className="profile-section-title">Your Orders</h2>
          <p className="acct-section-subtitle">Your recent orders from campus outlets</p>
        </div>
        <button className="profile-see-all-btn" onClick={() => navigate('/student/orders')}>
          See all
        </button>
      </div>

      {MOCK_ORDERS.length === 0 ? (
        <div className="empty-orders-state" style={{ border: 'none', padding: '2rem 0' }}>
          <div className="empty-icon-wrapper">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h2>No orders yet</h2>
          <p>Looks like you haven't placed any orders yet.</p>
          <button className="order-again-btn" style={{ marginTop: '1.25rem' }} onClick={() => navigate('/student')}>
            Order now
          </button>
        </div>
      ) : (
        <div className="profile-orders-list">
          {MOCK_ORDERS.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <div>
                  <h3 className="order-outlet">{order.outletName}</h3>
                  <p className="order-date">{order.date}</p>
                </div>
                <div className="order-status">{order.status}</div>
              </div>
              <div className="order-items-container">
                {order.items.map((item, idx) => (
                  <div key={idx} className="order-item">
                    <span className="item-quantity">{item.quantity} ×</span>
                    <span className="item-name">{item.name}</span>
                  </div>
                ))}
              </div>
              <div className="order-footer">
                <div className="order-total">
                  <span className="total-label">Total</span>
                  <span className="total-amount">&#8377;{order.total}</span>
                </div>
                <button className="order-again-btn" onClick={() => alert('Order again coming soon!')}>
                  Order again
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

export default Profile;
