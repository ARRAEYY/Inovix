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
    <div className="min-h-screen">
      <Header />

      <main className="max-w-[1300px] mx-auto px-8 py-16">
        <div className="mb-10">
          <p className="font-semibold text-[#EA580C] text-[1.35rem] mb-1 tracking-tight">Welcome back, {user?.name || 'Student'}</p>
          <h1 className="text-[2.5rem] font-extrabold text-[#0F172A] tracking-tight mb-2">Explore Outlets</h1>
          <p className="text-[1.1rem] text-[#475569] font-normal">Order from your favorite campus outlets</p>
        </div>

        <div className="flex justify-between items-center mb-10 gap-4 flex-wrap">
          <div className="relative w-full max-w-[450px]">
            <svg className="absolute left-5 top-1/2 -translate-y-1/2 text-[#94A3B8]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="w-full py-3 px-12 border border-[#FCEAE1] rounded-full text-[0.95rem] outline-none transition-all focus:border-[#EA580C] focus:shadow-[0_0_0_3px_rgba(234,88,12,0.1)]"
              placeholder="Search outlets, cuisines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 border border-[#FCEAE1] rounded-md px-1.5 text-xs text-[#94A3B8] bg-gray-50">/</div>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-0">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${activeFilter === filter ? 'bg-[#EA580C] text-white' : 'bg-white border border-[#FCEAE1] text-[#475569] hover:bg-gray-50'}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-[#94A3B8]">
            <p>Loading outlets…</p>
          </div>
        ) : filteredOutlets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOutlets.map((outlet) => (
              <OutletCard key={outlet.id} outlet={outlet} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-[#94A3B8]">
            <p>No outlets found matching your criteria.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;
