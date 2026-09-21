import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Header from '../../components/layout/Header';
import OutletCard from '../../components/food/OutletCard';
import { useAuth } from '../../hooks/useAuth';
import { catalogService } from '../../services/catalog/catalogService';

const FILTERS = ['All', 'Open now'];

const Home = () => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: outlets, isLoading } = useQuery({
    queryKey: ['outlets', 'list'],
    queryFn: catalogService.getOutlets,
    // don't retry on 401 — client interceptor handles refresh
  });

  // Search via /catalog/search when query is non-empty
  const { data: searchResults } = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: () => catalogService.search(searchQuery),
    enabled: searchQuery.trim().length > 1,
    staleTime: 30_000,
  });

  // Show search results (outlets) when searching; otherwise full outlet list
  const sourceOutlets = searchQuery.trim().length > 1
    ? (searchResults?.outlets ?? [])
    : (outlets ?? []);

  const filteredOutlets = sourceOutlets.filter((outlet) => {
    const matchesFilter = activeFilter === 'All'
      ? true
      : (outlet.status === 'OPEN' || outlet.status === 'BUSY');
    return matchesFilter;
  });

  return (
    <div className="page-wrapper">
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
            {FILTERS.map((filter) => (
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

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-light)' }}>
            <p>Loading outlets…</p>
          </div>
        ) : filteredOutlets.length > 0 ? (
          <div className="outlets-grid">
            {filteredOutlets.map((outlet) => (
              <OutletCard key={outlet.id} outlet={outlet} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-light)' }}>
            <p>No outlets found matching your criteria.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;
