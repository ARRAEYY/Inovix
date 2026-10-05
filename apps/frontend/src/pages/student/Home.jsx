import React, { useState, useEffect } from 'react';
import Header from '../../components/layout/Header';
import OutletCard from '../../components/food/OutletCard';
import MobileBottomNav from '../../components/layout/MobileBottomNav';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import client from '../../services/api/client';
import { catalogService } from '../../services/api/catalogService';
import { cacheGet, cacheSet, cacheGetStale } from '../../services/cache/localCache';
import SkeletonGrid from '../../components/common/Skeleton';

// Map a catalog outlet (Prisma Outlet model) onto the fields OutletCard
// renders. Only OPEN/BUSY outlets are returned by the backend.
const mapOutlet = (o) => ({
  id: o.id,
  name: o.name,
  description: o.description,
  image: o.logoUrl || '/images/cafe.jpg',
  active: o.status === 'OPEN' || o.status === 'BUSY',
  rating: o.rating,
  time: (o.estimatedTime || '').replace(' min', '') || '15-20',
  location: o.location,
  tags: (o.tags || '').split(',').map(t => t.trim()).filter(Boolean),
});

const Home = () => {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Instant SWR: Read from localStorage immediately so the outlets list paints with 0ms delay!
  const initialCache = React.useMemo(() => cacheGetStale('outlets'), []);
  const [outlets, setOutlets] = useState(() => (initialCache.data || []).map(mapOutlet));
  const [loading, setLoading] = useState(() => !initialCache.data?.length);
  const [favorites, setFavorites] = useState(new Set());
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch favorite outlet IDs
    client.get('/favorites').then(res => {
      setFavorites(new Set((res.data?.data || []).map(f => f.outletId)));
    }).catch(() => {});

    const fetchOutlets = async () => {
      try {
        const res = await catalogService.getOutlets();
        const raw = res.data || [];
        cacheSet('outlets', raw);
        setOutlets(raw.map(mapOutlet));
        setError(null);
      } catch (err) {
        if (!initialCache.data?.length) {
          setError(err.message || 'Failed to load outlets');
        }
        console.error('Failed to fetch outlets:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOutlets();
  }, [initialCache]);

  const toggleFavorite = async (e, outletId) => {
    e.stopPropagation();
    e.preventDefault();
    const isFav = favorites.has(outletId);
    setFavorites(prev => { const next = new Set(prev); if (isFav) next.delete(outletId); else next.add(outletId); return next; });
    try {
      if (isFav) { await client.delete(`/favorites/${outletId}`); toast('Removed from favorites'); }
      else { await client.post(`/favorites/${outletId}`); toast.success('Added to favorites'); }
    } catch (err) { toast('Failed to update favorites'); setFavorites(prev => { const next = new Set(prev); if (isFav) next.add(outletId); else next.delete(outletId); return next; }); }
  };

  // Category chips are derived from the outlets' own tags, so the row always
  // reflects what campus outlets actually serve (no hardcoded list).
  const categories = React.useMemo(() => {
    const set = new Set();
    outlets.forEach(o => (o.tags || []).forEach(t => set.add(t)));
    return ['All', ...Array.from(set).sort()];
  }, [outlets]);

  const query = searchQuery.trim().toLowerCase();

  const filteredOutlets = outlets.filter(outlet => {
    const matchesSearch = !query ||
      (outlet.name || '').toLowerCase().includes(query) ||
      (outlet.description || '').toLowerCase().includes(query) ||
      (outlet.tags || []).some(t => t.toLowerCase().includes(query));

    const matchesCategory = activeCategory === 'All' || (outlet.tags || []).includes(activeCategory);

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="page-wrapper home-wrapper">
      <Header />

      <main className="explore-container">
        <div className="page-header">
          <p className="welcome-greeting">Welcome back, {user?.name || 'Student'}</p>
          <h1 className="page-title">Explore Outlets</h1>
          <p className="page-subtitle">Order from your favorite campus outlets</p>
        </div>

        <div className="controls-row">
          <div className="search-container">
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search for food, drinks or outlets"
              aria-label="Search for food, drinks or outlets"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Food-category discovery — derived from outlet tags */}
        {!loading && categories.length > 1 && (
          <div className="category-tabs" role="tablist" aria-label="Food categories">
            {categories.map(cat => (
              <button
                key={cat}
                role="tab"
                aria-selected={activeCategory === cat}
                className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <SkeletonGrid count={6} cols={3} />
        ) : error ? (
          <div className="state-block">
            <div className="state-icon">⚠️</div>
            <p className="state-title">Something went wrong</p>
            <p className="state-sub">{error}</p>
            <button className="primary-btn" onClick={() => window.location.reload()}>Try Again</button>
          </div>
        ) : filteredOutlets.length > 0 ? (
          <div className="outlets-grid">
            {filteredOutlets.map(outlet => (
              <OutletCard key={outlet.id} outlet={outlet} />
            ))}
          </div>
        ) : (
          <div className="state-block">
            <div className="state-icon">🍽️</div>
            <p className="state-title">No outlets found</p>
            <p className="state-sub">
              {query || activeCategory !== 'All'
                ? `Nothing matches "${query || activeCategory}". Try a different search.`
                : 'Check back later — outlets open throughout the day.'}
            </p>
            {(query || activeCategory !== 'All') && (
              <button className="primary-btn" onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default Home;
