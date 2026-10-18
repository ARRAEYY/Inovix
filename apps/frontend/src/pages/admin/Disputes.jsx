import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../services/api/client';

const STATUS_COLORS = {
  OPEN: { bg: '#fffbeb', text: '#d97706' },
  RESOLVED: { bg: '#ecfdf5', text: '#059669' },
  REJECTED: { bg: '#fef2f2', text: '#dc2626' }
};

const Disputes = () => {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { dispute, action: 'RESOLVED' | 'REJECTED' }
  const [resolutionNote, setResolutionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/disputes');
      setDisputes(res.data?.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!actionModal) return;

    try {
      setSubmitting(true);
      await api.patch(`/disputes/${actionModal.dispute.id}`, {
        status: actionModal.action,
        resolution: resolutionNote.trim() || null,
      });
      toast.success(`Dispute ${actionModal.action.toLowerCase()} successfully`);
      setActionModal(null);
      setResolutionNote('');
      fetchDisputes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resolve dispute');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = disputes.filter(d => {
    const orderNum = (d.order?.orderNumber || d.orderId || '').toLowerCase();
    const userName = (d.user?.name || d.user?.email || '').toLowerCase();
    const outletName = (d.outlet?.name || '').toLowerCase();
    const desc = (d.description || '').toLowerCase();
    const q = search.toLowerCase();

    const matchesSearch = orderNum.includes(q) || userName.includes(q) || outletName.includes(q) || desc.includes(q);
    if (!matchesSearch) return false;

    if (filter === 'All') return true;
    return d.status === filter;
  });

  if (loading) return <AdminLayout><p style={{ padding: '24px' }}>Loading disputes...</p></AdminLayout>;
  if (error) return <AdminLayout><div className="error-message" style={{ margin: '24px' }}>{error}</div></AdminLayout>;

  return (
    <AdminLayout>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
              Disputes & Resolutions
            </h1>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem' }}>
              Review customer disputes, investigate issues, and record resolutions.
            </p>
          </div>
          <button 
            onClick={fetchDisputes}
            style={{ padding: '10px 18px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontWeight: '500' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh
          </button>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '8px' }}>
              {['All', 'OPEN', 'RESOLVED', 'REJECTED'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '6px 14px',
                    border: 'none',
                    background: filter === f ? 'white' : 'transparent',
                    color: filter === f ? '#111827' : '#6b7280',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            
            <input 
              type="text" 
              placeholder="Search by order #, student, or issue..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px', width: '280px', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={thStyle}>Order #</th>
                  <th style={thStyle}>Student</th>
                  <th style={thStyle}>Outlet</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#6b7280' }}>
                      No disputes found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((d, idx) => {
                    const badge = STATUS_COLORS[d.status] || { bg: '#f3f4f6', text: '#374151' };
                    const orderDisplay = d.order?.orderNumber || (d.orderId ? (d.orderId.includes('_') ? d.orderId.split('_')[1] : d.orderId.slice(-6)) : 'N/A');

                    return (
                      <tr key={d.id} style={{ borderBottom: idx !== filtered.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <td style={{ padding: '16px 24px', fontWeight: '700', color: '#111827', fontSize: '0.9rem' }}>
                          #{orderDisplay}
                        </td>
                        <td style={{ padding: '16px 24px', color: '#374151', fontWeight: '500' }}>
                          {d.user?.name || d.user?.email || 'Student'}
                        </td>
                        <td style={{ padding: '16px 24px', color: '#374151' }}>
                          {d.outlet?.name || 'N/A'}
                        </td>
                        <td style={{ padding: '16px 24px', color: '#4b5563', fontSize: '0.85rem' }}>
                          <span style={{ background: '#f3f4f6', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                            {d.type || 'General'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            background: badge.bg,
                            color: badge.text,
                          }}>
                            {d.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', color: '#6b7280', fontSize: '0.85rem' }}>
                          {new Date(d.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <button onClick={() => setSelectedDispute(d)} style={{ background: 'none', border: 'none', color: '#b10035', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem' }}>View</button>
                            {d.status === 'OPEN' && (
                              <>
                                <button
                                  onClick={() => {
                                    setActionModal({ dispute: d, action: 'RESOLVED' });
                                    setResolutionNote('');
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#059669', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}
                                >
                                  Resolve
                                </button>
                                <button
                                  onClick={() => {
                                    setActionModal({ dispute: d, action: 'REJECTED' });
                                    setResolutionNote('');
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View Dispute Modal */}
      {selectedDispute && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800' }}>
                Dispute #{selectedDispute.order?.orderNumber || selectedDispute.id.slice(-6)}
              </h2>
              <span style={{
                padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700',
                background: STATUS_COLORS[selectedDispute.status]?.bg || '#f3f4f6',
                color: STATUS_COLORS[selectedDispute.status]?.text || '#374151',
              }}>
                {selectedDispute.status}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', color: '#4b5563', fontSize: '0.92rem' }}>
              <div><strong style={{ color: '#111827' }}>Student:</strong> {selectedDispute.user?.name || selectedDispute.user?.email || 'Student'}</div>
              <div><strong style={{ color: '#111827' }}>Outlet:</strong> {selectedDispute.outlet?.name || 'N/A'}</div>
              <div><strong style={{ color: '#111827' }}>Category/Type:</strong> {selectedDispute.type || 'General'}</div>
              <div><strong style={{ color: '#111827' }}>Filed On:</strong> {new Date(selectedDispute.createdAt).toLocaleString()}</div>

              <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '14px', border: '1px solid #e5e7eb' }}>
                <strong style={{ display: 'block', marginBottom: '6px', color: '#111827' }}>Description:</strong>
                <p style={{ margin: 0, color: '#374151', lineHeight: 1.5 }}>{selectedDispute.description || 'No description provided'}</p>
              </div>

              {selectedDispute.resolution && (
                <div style={{ background: '#ecfdf5', borderRadius: '10px', padding: '14px', border: '1px solid #a7f3d0' }}>
                  <strong style={{ display: 'block', marginBottom: '4px', color: '#065f46' }}>Resolution Note:</strong>
                  <p style={{ margin: 0, color: '#047857', lineHeight: 1.5 }}>{selectedDispute.resolution}</p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setSelectedDispute(null)} style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Resolution Action Modal */}
      {actionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '1.35rem', fontWeight: '800', color: '#111827' }}>
              {actionModal.action === 'RESOLVED' ? 'Mark Dispute as Resolved' : 'Reject Dispute'}
            </h2>
            <p style={{ margin: '0 0 18px 0', color: '#6b7280', fontSize: '0.88rem' }}>
              Provide an optional note to record the resolution steps or reason for rejection.
            </p>

            <form onSubmit={handleResolveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>
                  Resolution Note (Optional)
                </label>
                <textarea
                  placeholder="e.g. Refund issued / replacement delivered / invalid complaint"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  disabled={submitting}
                  style={{ padding: '10px 18px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#374151' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    background: actionModal.action === 'RESOLVED' ? '#059669' : '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? 'Saving...' : actionModal.action === 'RESOLVED' ? 'Confirm Resolution' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AdminLayout>
  );
};

// Extracted styles
const cardStyle = {
  background: 'white',
  borderRadius: '16px',
  border: '1px solid #e5e7eb',
  padding: '24px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
};

const thStyle = {
  padding: '16px 24px',
  fontWeight: '600',
  color: '#4b5563',
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '0.95rem',
  color: '#111827'
};

export default Disputes;
