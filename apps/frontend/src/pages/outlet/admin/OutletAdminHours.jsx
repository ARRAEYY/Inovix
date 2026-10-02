import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import OutletAdminLayout from '../../../components/layout/OutletAdminLayout';
import client from '../../../services/api/client';

const DAYS = [
  { dayOfWeek: 0, name: 'Sunday' },
  { dayOfWeek: 1, name: 'Monday' },
  { dayOfWeek: 2, name: 'Tuesday' },
  { dayOfWeek: 3, name: 'Wednesday' },
  { dayOfWeek: 4, name: 'Thursday' },
  { dayOfWeek: 5, name: 'Friday' },
  { dayOfWeek: 6, name: 'Saturday' },
];

const OutletAdminHours = () => {
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchHours = async () => {
    try {
      setLoading(true);
      const res = await client.get('/outlet/staff/operating-hours');
      setHours(res.data?.data || []);
    } catch (err) {
      toast('Failed to load operating hours');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHours(); }, []);

  const handleChange = (dayOfWeek, field, value) => {
    setHours(prev => prev.map(h =>
      h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h
    ));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await client.put('/outlet/staff/operating-hours', { hours });
      toast('Operating hours saved');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Fill missing days with defaults
  const fullHours = DAYS.map(d => {
    const existing = hours.find(h => h.dayOfWeek === d.dayOfWeek);
    return existing || { ...d, openTime: '09:00', closeTime: '21:00', isClosed: false };
  });

  return (
    <OutletAdminLayout>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Operating Hours</h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>Set when your outlet is open for orders.</p>
          </div>
          <button onClick={handleSave} disabled={saving || loading}
            style={{ padding: '0.5rem 1.5rem', background: '#b10035', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {loading ? (
          <p style={{ color: '#6b7280' }}>Loading…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {fullHours.map(day => (
              <div key={day.dayOfWeek} style={{
                display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem',
                background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb',
              }}>
                <span style={{ width: '90px', fontWeight: 600, fontSize: '0.9rem' }}>{day.name}</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={day.isClosed} onChange={(e) => handleChange(day.dayOfWeek, 'isClosed', e.target.checked)} />
                  Closed
                </label>
                {!day.isClosed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="time" value={day.openTime} onChange={(e) => handleChange(day.dayOfWeek, 'openTime', e.target.value)}
                      style={{ padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem' }} />
                    <span style={{ color: '#9ca3af' }}>to</span>
                    <input type="time" value={day.closeTime} onChange={(e) => handleChange(day.dayOfWeek, 'closeTime', e.target.value)}
                      style={{ padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </OutletAdminLayout>
  );
};

export default OutletAdminHours;
