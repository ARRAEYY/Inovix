import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Users, Store, ShoppingBag, FileText, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import Header from '../../components/layout/Header';
import { adminService } from '../../services/admin/adminService';
import { useAuth } from '../../hooks/useAuth';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';

const TABS = [
  { id: 'overview', label: 'overview', icon: ShieldCheck },
  { id: 'users', label: 'users', icon: Users },
  { id: 'outlets', label: 'outlets', icon: Store },
  { id: 'orders', label: 'orders', icon: ShoppingBag },
  { id: 'audit', label: 'audit', icon: FileText },
];

const KpiCard = ({ title, stats, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow"
  >
    <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{title}</h3>
    <div className="space-y-1.5">
      {stats.map(([label, value], idx) => (
        <div key={label} className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-base font-semibold text-foreground">
            {idx === stats.length - 1 ? <AnimatedNumber value={value} /> : value}
          </span>
        </div>
      ))}
    </div>
  </motion.div>
);

const Th = ({ children }) => (
  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">{children}</th>
);
const Td = ({ children }) => (
  <td className="px-4 py-3 text-sm text-foreground">{children}</td>
);

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');

  const { data: overview } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: adminService.getOverview,
    refetchInterval: 60_000,
  });

  const { data: usersData } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminService.listUsers({ pageSize: 50 }),
    enabled: tab === 'users',
  });

  const { data: outletsData } = useQuery({
    queryKey: ['admin', 'outlets'],
    queryFn: adminService.listOutlets,
    enabled: tab === 'outlets' || tab === 'overview',
  });

  const { data: ordersData } = useQuery({
    queryKey: ['admin', 'orders'],
    queryFn: () => adminService.listOrders({ pageSize: 100 }),
    enabled: tab === 'orders',
  });

  const { data: auditData } = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => adminService.listAudit({ pageSize: 50 }),
    enabled: tab === 'audit',
  });

  const userStatusMut = useMutation({
    mutationFn: ({ userId, status }) => adminService.updateUserStatus(userId, status),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(`User ${vars.status === 'SUSPENDED' ? 'suspended' : 'reactivated'}`);
    },
  });

  const outletStatusMut = useMutation({
    mutationFn: ({ outletId, status }) => adminService.updateOutletStatus(outletId, status),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'outlets'] });
      toast.success(`Outlet marked ${vars.status}`);
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between mb-8"
        >
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span>Welcome back, {user?.name || 'Admin'}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
              Platform <span className="text-accent">Admin</span>
            </h1>
            <p className="text-base text-muted-foreground mt-2">Manage users, outlets, orders, and audit logs</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 border border-border bg-card text-foreground text-sm font-semibold rounded-lg hover:bg-muted transition-colors inline-flex items-center gap-2"
            onClick={() => { logout(); navigate('/'); }}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </motion.button>
        </motion.div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`relative px-4 py-2 rounded-xl text-xs font-medium transition-all inline-flex items-center gap-1.5 ${
                  tab === t.id
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                    : 'bg-card border border-border text-foreground hover:bg-muted'
                }`}
                onClick={() => setTab(t.id)}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'overview' && overview && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <KpiCard title="Users" stats={[
                    ['Students', overview.users.students],
                    ['Outlet Admins', overview.users.outletAdmins],
                    ['Outlet Staff', overview.users.outletStaff],
                    ['Super Admins', overview.users.superAdmins],
                    ['Total', overview.users.total],
                  ]} delay={0} />
                  <KpiCard title="Outlets" stats={[
                    ['Open', overview.outlets.open],
                    ['Busy', overview.outlets.busy],
                    ['Closed', overview.outlets.closed],
                    ['Pending', overview.outlets.pending],
                    ['Suspended', overview.outlets.suspended],
                    ['Total', overview.outlets.total],
                  ]} delay={0.08} />
                  <KpiCard title="Menu Items" stats={[
                    ['Available', overview.menu.available],
                    ['Unavailable', overview.menu.unavailable],
                    ['Total', overview.menu.total],
                  ]} delay={0.16} />
                  <KpiCard title="Orders" stats={[
                    ['Pending', overview.orders.pending],
                    ['Accepted', overview.orders.accepted],
                    ['Preparing', overview.orders.preparing],
                    ['Ready', overview.orders.ready],
                    ['Completed', overview.orders.completed],
                    ['Rejected', overview.orders.rejected],
                    ['Cancelled', overview.orders.cancelled],
                    ['Total', overview.orders.total],
                  ]} delay={0.24} />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-foreground tracking-tight mb-4">Outlets</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(outletsData ?? []).map((o, idx) => (
                      <motion.div
                        key={o.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-foreground">{o.name}</h3>
                            <p className="text-xs text-muted-foreground">{o.slug}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                            o.status === 'OPEN' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${o.status === 'OPEN' ? 'bg-success' : 'bg-muted-foreground'}`} />
                            {o.status}
                          </span>
                        </div>
                        <div className="flex gap-1.5 flex-wrap mt-3">
                          {['OPEN', 'BUSY', 'CLOSED', 'SUSPENDED'].map((s) => (
                            <button
                              key={s}
                              className="px-2 py-0.5 text-[0.65rem] bg-muted text-foreground rounded hover:bg-border transition-colors disabled:opacity-50"
                              onClick={() => outletStatusMut.mutate({ outletId: o.id, status: s })}
                              disabled={outletStatusMut.isPending}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'users' && usersData && (
              <div className="bg-card border border-border rounded-xl overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Outlet</Th><Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersData.items.map((u) => (
                      <tr key={u.id} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                        <Td>{u.name}</Td>
                        <Td>{u.email}</Td>
                        <Td><span className="px-2 py-0.5 text-xs bg-muted text-foreground rounded-md">{u.role}</span></Td>
                        <Td>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.status === 'ACTIVE' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'ACTIVE' ? 'bg-success' : 'bg-destructive'}`} />
                            {u.status}
                          </span>
                        </Td>
                        <Td>{u.outletStaff?.outletId || '—'}</Td>
                        <Td>
                          {u.status === 'ACTIVE' ? (
                            <button
                              className="px-2 py-0.5 text-xs text-destructive border border-destructive/30 rounded hover:bg-destructive/5 transition-colors disabled:opacity-50"
                              onClick={() => userStatusMut.mutate({ userId: u.id, status: 'SUSPENDED' })}
                              disabled={userStatusMut.isPending || u.id === user.id}
                            >
                              {u.id === user.id ? 'self' : 'Suspend'}
                            </button>
                          ) : (
                            <button
                              className="px-2 py-0.5 text-xs text-success border border-success/30 rounded hover:bg-success/5 transition-colors disabled:opacity-50"
                              onClick={() => userStatusMut.mutate({ userId: u.id, status: 'ACTIVE' })}
                              disabled={userStatusMut.isPending}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {outletsData.map((o, idx) => (
                  <motion.div
                    key={o.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-foreground">{o.name}</h3>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                        o.status === 'OPEN' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${o.status === 'OPEN' ? 'bg-success' : 'bg-muted-foreground'}`} />
                        {o.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{o.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">★ {o.rating} · {o.estimatedTime}</p>
                    <div className="flex gap-1.5 flex-wrap mt-3">
                      {['OPEN', 'BUSY', 'CLOSED', 'SUSPENDED'].map((s) => (
                        <button
                          key={s}
                          className="px-2 py-0.5 text-[0.65rem] bg-muted text-foreground rounded hover:bg-border transition-colors disabled:opacity-50"
                          onClick={() => outletStatusMut.mutate({ outletId: o.id, status: s })}
                          disabled={outletStatusMut.isPending}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {tab === 'orders' && ordersData && (
              <div className="bg-card border border-border rounded-xl overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <Th>Order #</Th><Th>Outlet</Th><Th>Status</Th><Th>Total</Th><Th>Placed</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersData.items.map((o) => (
                      <tr key={o.id} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                        <Td><span className="font-semibold">{o.orderNumber}</span></Td>
                        <Td>{o.outlet?.name || o.outletId}</Td>
                        <Td><span className="px-2 py-0.5 text-xs bg-muted text-foreground rounded-md">{o.status}</span></Td>
                        <Td>₹{Number(o.totalAmount)}</Td>
                        <Td>{new Date(o.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'audit' && auditData && (
              <div className="bg-card border border-border rounded-xl overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Target ID</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditData.items.map((a) => (
                      <tr key={a.id} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                        <Td>{new Date(a.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</Td>
                        <Td>{a.actor?.email || a.actorUserId || 'system'}</Td>
                        <Td><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{a.action}</code></Td>
                        <Td>{a.targetType}</Td>
                        <Td><span className="text-xs text-muted-foreground">{a.targetId || '—'}</span></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Dashboard;
