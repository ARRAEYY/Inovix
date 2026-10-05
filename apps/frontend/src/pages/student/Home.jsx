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

const FILTERS = ['All', 'Open now'];

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
});

const Home = () => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState('All');
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

  const filteredOutlets = outlets.filter(outlet => {
    const matchesSearch =
      (outlet.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (outlet.description || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = activeFilter === 'All' ? true : outlet.active;

    return matchesSearch && matchesFilter;
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
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search outlets, cuisines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="shortcut-hint">/</div>
          </div>

          <div className="filter-pills">
            {FILTERS.map(filter => (
              <button 
                key={filter} 
                className={`pill ${activeFilter === filter ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-light)' }}>
            <SkeletonGrid count={6} cols={3} />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-light)' }}>
            <p>{error}</p>
          </div>
        ) : filteredOutlets.length > 0 ? (
          <div className="outlets-grid">
            {filteredOutlets.map(outlet => (
              <OutletCard key={outlet.id} outlet={outlet} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-light)' }}>
            <p>No outlets found matching your criteria.</p>
          </div>
        )}
      </main>
      
      <MobileBottomNav />
    </div>
  );
};

export default Home;
