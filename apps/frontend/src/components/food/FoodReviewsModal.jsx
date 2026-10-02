import React, { useState, useEffect } from 'react';
import { reviewService } from '../../services/api/reviewService';

// FoodReviewsModal — per-menu-item review list, opened from a FoodCard's
// rating chip. Reviews hydrate instantly from the localStorage cache and
// refresh in the background (reviewService handles the caching).

const formatTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const Stars = ({ value, size = '0.85rem' }) => (
  <span style={{ color: '#f59e0b', fontSize: size, letterSpacing: '1px' }}>
    {'★'.repeat(Math.round(value))}{'☆'.repeat(Math.max(0, 5 - Math.round(value)))}
  </span>
);

const FoodReviewsModal = ({ item, onClose }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!item) return undefined;
    let active = true;
    const { cached, fetch } = reviewService.getForFood(item.id);
    if (cached) {
      setReviews(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    fetch()
      .then((list) => {
        if (!active) return;
        setReviews(list);
        setError(null);
      })
      .catch((err) => {
        if (active && !cached) setError(err.message || 'Failed to load reviews');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [item]);

  if (!item) return null;

  const summary = item.foodRating || null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`${item.name} reviews`}
        style={{ background: 'white', borderRadius: '14px', maxWidth: '420px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.1rem 1.25rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-dark)' }}>{item.name}</h3>
            {summary && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem' }}>
                <Stars value={summary.avg} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dark)' }}>{summary.avg}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>({summary.count} food review{summary.count === 1 ? '' : 's'})</span>
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close reviews" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '0.75rem 1.25rem 1.25rem' }}>
          {loading ? (
            <p style={{ color: 'var(--text-gray)', fontSize: '0.9rem' }}>Loading reviews…</p>
          ) : error ? (
            <p style={{ color: '#b10035', fontSize: '0.9rem' }}>{error}</p>
          ) : reviews.length === 0 ? (
            <p style={{ color: 'var(--text-gray)', fontSize: '0.9rem' }}>
              No food reviews yet. Rate this item from your Orders page after your next meal.
            </p>
          ) : (
            reviews.map((r, idx) => (
              <div key={r.id} style={{ padding: '0.7rem 0', borderBottom: idx !== reviews.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-dark)' }}>{r.user?.name || 'Student'}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light, #9ca3af)' }}>{formatTime(r.createdAt)}</span>
                </div>
                <div style={{ marginTop: '0.15rem' }}><Stars value={r.rating} /></div>
                {r.comment && (
                  <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.88rem', color: 'var(--text-gray)', lineHeight: 1.45 }}>{r.comment}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodReviewsModal;
