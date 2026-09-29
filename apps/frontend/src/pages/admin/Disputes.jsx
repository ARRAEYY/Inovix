import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../services/api/client';

const STATUS_COLORS = { OPEN: '#f59e0b', RESOLVED: '#10b981', REJECTED: '#ef4444' };

const Disputes = () => {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/disputes');
      setDisputes(res.data?.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load disputes');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchDisputes(); }, []);

  const handleResolve = async (id, status) => {
    const resolution = prompt('Resolution note (optional):', '');
    try {
      await api.patch(`/disputes/${id}`, { status, resolution: resolution || null });
      toast.success(`Dispute ${status.toLowerCase()}`);
      fetchDisputes();
    } catch (err) { toast(err.response?.data?.message || 'Failed to resolve'); }
  };

  const filtered = disputes.filter(d => filter === 'All' || d.status === filter);

  return (
    <AdminLayout>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Disputes</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['All', 'OPEN', 'RESOLVED', 'REJECTED'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '0.3rem 0.8rem', border: 'none', borderRadius: '20px', cursor: 'pointer',
                  background: filter === f ? '#b10035' : '#f3f4f6', color: filter === f ? 'white' : '#374151',
                  fontWeight: 600, fontSize: '0.85rem' }}>{f}</button>
            ))}
          </div>
        </div>

        {loading ? <p>Loading…</p> : error ? <p style={{ color: '#dc2626' }}>{error}</p> : filtered.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>No disputes found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filtered.map(d => (
              <div key={d.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{d.order?.orderNumber || d.orderId}</span>
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>{d.type}</span>
                  </div>
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                    background: STATUS_COLORS[d.status] + '20', color: STATUS_COLORS[d.status] }}>{d.status}</span>
                </div>
                <p style={{ fontSize: '0.9rem', color: '#374151', margin: '0.5rem 0' }}>{d.description}</p>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                  <span>👤 {d.user?.name || d.user?.email}</span>
                  <span>🏪 {d.outlet?.name}</span>
                  <span>📅 {new Date(d.createdAt).toLocaleDateString()}</span>
                </div>
                {d.resolution && <p style={{ fontSize: '0.85rem', color: '#10b981', background: '#f0fdf4', padding: '0.4rem 0.6rem', borderRadius: '6px', margin: '0.5rem 0' }}>Resolution: {d.resolution}</p>}
                {d.status === 'OPEN' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleResolve(d.id, 'RESOLVED')} style={{ padding: '0.3rem 0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Resolve</button>
                    <button onClick={() => handleResolve(d.id, 'REJECTED')} style={{ padding: '0.3rem 0.8rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default Disputes;
