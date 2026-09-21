import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import { adminService } from '../../services/admin/adminService';
import { useAuth } from '../../hooks/useAuth';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview'); // overview | users | outlets | orders | audit

  // Overview
  const { data: overview } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: adminService.getOverview,
    refetchInterval: 60_000,
  });

  // Users
  const { data: usersData } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminService.listUsers({ pageSize: 50 }),
    enabled: tab === 'users',
  });

  // Outlets
  const { data: outletsData } = useQuery({
    queryKey: ['admin', 'outlets'],
    queryFn: adminService.listOutlets,
    enabled: tab === 'outlets' || tab === 'overview',
  });

  // Orders
  const { data: ordersData } = useQuery({
    queryKey: ['admin', 'orders'],
    queryFn: () => adminService.listOrders({ pageSize: 100 }),
    enabled: tab === 'orders',
  });

  // Audit log
  const { data: auditData } = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => adminService.listAudit({ pageSize: 50 }),
    enabled: tab === 'audit',
  });

  // Mutations
  const userStatusMut = useMutation({
    mutationFn: ({ userId, status }) => adminService.updateUserStatus(userId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const outletStatusMut = useMutation({
    mutationFn: ({ outletId, status }) => adminService.updateOutletStatus(outletId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'outlets'] }),
  });

  const TABS = ['overview', 'users', 'outlets', 'orders', 'audit'];

  return (
    <div className="page-wrapper">
      <Header />
      <main className="explore-container" style={{ maxWidth: '1400px' }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="welcome-greeting">Welcome back, {user?.name || 'Admin'}</p>
            <h1 className="page-title">Platform Admin</h1>
            <p className="page-subtitle">Manage users, outlets, orders, and audit logs</p>
          </div>
          <button className="pill" onClick={() => { logout(); navigate('/'); }} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="filter-pills" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t}
              className={`pill ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
              style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', textTransform: 'capitalize' }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && overview && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <KpiCard title="Users" stats={[
                ['Students', overview.users.students],
                ['Outlet Admins', overview.users.outletAdmins],
                ['Outlet Staff', overview.users.outletStaff],
                ['Super Admins', overview.users.superAdmins],
                ['Total', overview.users.total],
              ]} />
              <KpiCard title="Outlets" stats={[
                ['Open', overview.outlets.open],
                ['Busy', overview.outlets.busy],
                ['Closed', overview.outlets.closed],
                ['Pending', overview.outlets.pending],
                ['Suspended', overview.outlets.suspended],
                ['Total', overview.outlets.total],
              ]} />
              <KpiCard title="Menu Items" stats={[
                ['Available', overview.menu.available],
                ['Unavailable', overview.menu.unavailable],
                ['Total', overview.menu.total],
              ]} />
              <KpiCard title="Orders" stats={[
                ['Pending', overview.orders.pending],
                ['Accepted', overview.orders.accepted],
                ['Preparing', overview.orders.preparing],
                ['Ready', overview.orders.ready],
                ['Completed', overview.orders.completed],
                ['Rejected', overview.orders.rejected],
                ['Cancelled', overview.orders.cancelled],
                ['Total', overview.orders.total],
              ]} />
            </div>

            <div style={{ marginTop: '2rem' }}>
              <h2 className="section-title">Outlets</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                {(outletsData ?? []).map((o) => (
                  <div key={o.id} className="outlet-card" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{o.name}</h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{o.slug}</p>
                      </div>
                      <span className={`status-badge ${o.status === 'OPEN' ? 'active' : 'inactive'}`}>
                        <span className="status-dot"></span>{o.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                      {['OPEN', 'BUSY', 'CLOSED', 'SUSPENDED'].map((s) => (
                        <button
                          key={s}
                          className="pill"
                          onClick={() => outletStatusMut.mutate({ outletId: o.id, status: s })}
                          disabled={outletStatusMut.isPending}
                          style={{ padding: '2px 8px', fontSize: '0.65rem' }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'users' && usersData && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                  <Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Outlet</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {usersData.items.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <Td>{u.name}</Td>
                    <Td>{u.email}</Td>
                    <Td><span className="pill" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>{u.role}</span></Td>
                    <Td>
                      <span className={`status-badge ${u.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                        <span className="status-dot"></span>{u.status}
                      </span>
                    </Td>
                    <Td>{u.outletStaff?.outletId || '—'}</Td>
                    <Td>
                      {u.status === 'ACTIVE' ? (
                        <button
                          className="pill"
                          onClick={() => userStatusMut.mutate({ userId: u.id, status: 'SUSPENDED' })}
                          disabled={userStatusMut.isPending || u.id === user.id}
                          style={{ padding: '2px 8px', fontSize: '0.7rem', color: 'var(--destructive)' }}
                        >
                          {u.id === user.id ? 'self' : 'Suspend'}
                        </button>
                      ) : (
                        <button
                          className="pill"
                          onClick={() => userStatusMut.mutate({ userId: u.id, status: 'ACTIVE' })}
                          disabled={userStatusMut.isPending}
                          style={{ padding: '2px 8px', fontSize: '0.7rem', color: 'var(--success)' }}
                        >
                          Activate
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'outlets' && outletsData && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {outletsData.map((o) => (
              <div key={o.id} className="outlet-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <h3 style={{ fontWeight: 600 }}>{o.name}</h3>
                  <span className={`status-badge ${o.status === 'OPEN' ? 'active' : 'inactive'}`}>
                    <span className="status-dot"></span>{o.status}
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.25rem' }}>{o.description}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>★ {o.rating} · {o.estimatedTime}</p>
                <div style={{ display: 'flex', gap: '4px', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  {['OPEN', 'BUSY', 'CLOSED', 'SUSPENDED'].map((s) => (
                    <button
                      key={s}
                      className="pill"
                      onClick={() => outletStatusMut.mutate({ outletId: o.id, status: s })}
                      disabled={outletStatusMut.isPending}
                      style={{ padding: '2px 8px', fontSize: '0.65rem' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'orders' && ordersData && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                  <Th>Order #</Th><Th>Outlet</Th><Th>Status</Th><Th>Total</Th><Th>Placed</Th>
                </tr>
              </thead>
              <tbody>
                {ordersData.items.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <Td><strong>{o.orderNumber}</strong></Td>
                    <Td>{o.outlet?.name || o.outletId}</Td>
                    <Td><span className="pill" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>{o.status}</span></Td>
                    <Td>₹{Number(o.totalAmount)}</Td>
                    <Td>{new Date(o.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && auditData && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                  <Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Target ID</Th>
                </tr>
              </thead>
              <tbody>
                {auditData.items.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <Td>{new Date(a.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</Td>
                    <Td>{a.actor?.email || a.actorUserId || 'system'}</Td>
                    <Td><code style={{ fontSize: '0.75rem' }}>{a.action}</code></Td>
                    <Td>{a.targetType}</Td>
                    <Td style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>{a.targetId || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

const KpiCard = ({ title, stats }) => (
  <div className="outlet-card" style={{ padding: '1.25rem' }}>
    <h3 style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h3>
    {stats.map(([label, value]) => (
      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.25rem 0' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>{label}</span>
        <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{value}</span>
      </div>
    ))}
  </div>
);

const Th = ({ children }) => (
  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)' }}>{children}</th>
);
const Td = ({ children, ...rest }) => (
  <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-dark)' }} {...rest}>{children}</td>
);

export default Dashboard;
