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
  });

  const { data: searchResults } = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: () => catalogService.search(searchQuery),
    enabled: searchQuery.trim().length > 1,
    staleTime: 30_000,
  });

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
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground mb-1">Welcome back, {user?.name || 'Student'}</p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Explore Outlets</h1>
          <p className="text-base text-muted-foreground mt-1">Order from your favorite campus outlets</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="w-full pl-10 pr-4 py-3 bg-card border border-input rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-shadow"
              placeholder="Search outlets, cuisines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeFilter === filter ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:bg-muted'}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading outlets…</div>
        ) : filteredOutlets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOutlets.map((outlet) => (
              <OutletCard key={outlet.id} outlet={outlet} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <p>No outlets found matching your criteria.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;
