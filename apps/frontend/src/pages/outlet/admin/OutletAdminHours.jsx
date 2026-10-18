import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import OutletAdminLayout from '../../../components/layout/OutletAdminLayout';
import client from '../../../services/api/client';

const DAYS_ORDER = [
  { dayOfWeek: 1, name: 'Monday', short: 'Mon' },
  { dayOfWeek: 2, name: 'Tuesday', short: 'Tue' },
  { dayOfWeek: 3, name: 'Wednesday', short: 'Wed' },
  { dayOfWeek: 4, name: 'Thursday', short: 'Thu' },
  { dayOfWeek: 5, name: 'Friday', short: 'Fri' },
  { dayOfWeek: 6, name: 'Saturday', short: 'Sat' },
  { dayOfWeek: 0, name: 'Sunday', short: 'Sun' },
];

const formatTimeLabel = (timeStr) => {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const padH = String(h).padStart(2, '0');
  return `${padH}:${m} ${ampm}`;
};

// Generate standard 30-minute intervals throughout the day
const BASE_TIME_OPTIONS = (() => {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const value = `${hh}:${mm}`;
      options.push({ value, label: formatTimeLabel(value) });
    }
  }
  options.push({ value: '23:59', label: '11:59 PM' });
  return options;
})();

const getTimeOptions = (currentTime) => {
  const hasCurrent = BASE_TIME_OPTIONS.some((o) => o.value === currentTime);
  if (!hasCurrent && currentTime) {
    const custom = { value: currentTime, label: formatTimeLabel(currentTime) };
    return [...BASE_TIME_OPTIONS, custom].sort((a, b) => a.value.localeCompare(b.value));
  }
  return BASE_TIME_OPTIONS;
};

const OutletAdminHours = () => {
  const [hours, setHours] = useState(() =>
    DAYS_ORDER.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      name: d.name,
      short: d.short,
      openTime: '08:00',
      closeTime: '23:00',
      isClosed: false,
    }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchHours = async () => {
    try {
      setLoading(true);
      const res = await client.get('/outlet/staff/operating-hours');
      const loaded = res.data?.data || [];
      const normalized = DAYS_ORDER.map((d) => {
        const found = loaded.find((h) => h.dayOfWeek === d.dayOfWeek);
        return {
          dayOfWeek: d.dayOfWeek,
          name: d.name,
          short: d.short,
          openTime: found?.openTime || '08:00',
          closeTime: found?.closeTime || '23:00',
          isClosed: found ? !!found.isClosed : false,
        };
      });
      setHours(normalized);
    } catch (err) {
      toast.error('Failed to load operating hours');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHours();
  }, []);

  const handleChange = (dayOfWeek, field, value) => {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h))
    );
  };

  const handleCopyToAll = (sourceDay) => {
    setHours((prev) =>
      prev.map((h) => ({
        ...h,
        openTime: sourceDay.openTime,
        closeTime: sourceDay.closeTime,
        isClosed: sourceDay.isClosed,
      }))
    );
    toast.success(`Copied ${sourceDay.name}'s hours to all days`);
  };

  const handleApplyPreset = (openTime, closeTime) => {
    setHours((prev) =>
      prev.map((h) => ({
        ...h,
        openTime,
        closeTime,
        isClosed: false,
      }))
    );
    toast.success(`Applied ${formatTimeLabel(openTime)} – ${formatTimeLabel(closeTime)} to all days`);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = hours.map(({ dayOfWeek, openTime, closeTime, isClosed }) => ({
        dayOfWeek,
        openTime,
        closeTime,
        isClosed: !!isClosed,
      }));
      await client.put('/outlet/staff/operating-hours', { hours: payload });
      toast.success('Operating hours saved successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save operating hours');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OutletAdminLayout>
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '1.25rem 1rem 3rem' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#111827' }}>
              Operating Hours
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
              Set when your outlet is open to accept student orders.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              padding: '0.55rem 1.5rem',
              background: '#b10035',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: saving || loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              boxShadow: '0 1px 2px rgba(177, 0, 53, 0.2)',
              transition: 'all 0.15s ease',
              opacity: saving || loading ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* Quick Presets Ribbon */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '0.85rem 1.15rem',
            marginBottom: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>
              ⚡ Quick Presets:
            </span>
            <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
              Apply standard hours across all days:
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {[
              { label: '8 AM – 11 PM', open: '08:00', close: '23:00' },
              { label: '9 AM – 9 PM', open: '09:00', close: '21:00' },
              { label: '10 AM – 10 PM', open: '10:00', close: '22:00' },
              { label: 'Open 24/7', open: '00:00', close: '23:59' },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleApplyPreset(preset.open, preset.close)}
                style={{
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#b10035';
                  e.currentTarget.style.color = '#b10035';
                  e.currentTarget.style.background = '#faf5f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.color = '#374151';
                  e.currentTarget.style.background = '#f9fafb';
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule List */}
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontWeight: 500 }}>
            Loading operating hours…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {hours.map((day) => {
              const openOptions = getTimeOptions(day.openTime);
              const closeOptions = getTimeOptions(day.closeTime);

              return (
                <div
                  key={day.dayOfWeek}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    padding: '0.85rem 1.15rem',
                    background: day.isClosed ? '#f9fafb' : '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: day.isClosed ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
                    transition: 'all 0.2s ease',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Day identity */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      minWidth: '150px',
                    }}
                  >
                    <span
                      style={{
                        width: '42px',
                        height: '36px',
                        borderRadius: '8px',
                        background: day.isClosed ? '#e5e7eb' : '#faf5f6',
                        color: day.isClosed ? '#6b7280' : '#b10035',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        flexShrink: 0,
                      }}
                    >
                      {day.short}
                    </span>
                    <div>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          color: day.isClosed ? '#6b7280' : '#111827',
                        }}
                      >
                        {day.name}
                      </span>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        {day.dayOfWeek === 0 || day.dayOfWeek === 6 ? 'Weekend' : 'Weekday'}
                      </div>
                    </div>
                  </div>

                  {/* Open / Closed Toggle Switch */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleChange(day.dayOfWeek, 'isClosed', !day.isClosed)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.3rem 0.75rem',
                        borderRadius: '20px',
                        border: `1px solid ${day.isClosed ? '#d1d5db' : '#86efac'}`,
                        background: day.isClosed ? '#f3f4f6' : '#f0fdf4',
                        color: day.isClosed ? '#4b5563' : '#166534',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: day.isClosed ? '#9ca3af' : '#22c55e',
                        }}
                      />
                      {day.isClosed ? 'Closed' : 'Open'}
                    </button>
                  </div>

                  {/* Time Selection Dropdowns */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      flex: 1,
                      minWidth: '280px',
                      justifyContent: 'flex-end',
                      flexWrap: 'wrap',
                    }}
                  >
                    {day.isClosed ? (
                      <span
                        style={{
                          fontSize: '0.85rem',
                          color: '#9ca3af',
                          fontStyle: 'italic',
                          padding: '0.4rem 0',
                        }}
                      >
                        Outlet is closed for orders all day
                      </span>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>
                            Opens:
                          </span>
                          <select
                            value={day.openTime}
                            onChange={(e) =>
                              handleChange(day.dayOfWeek, 'openTime', e.target.value)
                            }
                            style={{
                              padding: '0.45rem 0.65rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '8px',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              color: '#111827',
                              background: '#ffffff',
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            {openOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <span
                          style={{
                            color: '#9ca3af',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            padding: '0 0.15rem',
                          }}
                        >
                          to
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>
                            Closes:
                          </span>
                          <select
                            value={day.closeTime}
                            onChange={(e) =>
                              handleChange(day.dayOfWeek, 'closeTime', e.target.value)
                            }
                            style={{
                              padding: '0.45rem 0.65rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '8px',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              color: '#111827',
                              background: '#ffffff',
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            {closeOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyToAll(day)}
                          title="Copy this day's hours to all other days"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#6b7280',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            padding: '0.35rem 0.5rem',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            marginLeft: '0.25rem',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#b10035';
                            e.currentTarget.style.background = '#faf5f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#6b7280';
                            e.currentTarget.style.background = 'none';
                          }}
                        >
                          📋 <span style={{ textDecoration: 'underline' }}>Copy to all</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </OutletAdminLayout>
  );
};

export default OutletAdminHours;
