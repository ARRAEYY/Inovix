import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, Sparkles, Clock, MapPin, Star } from 'lucide-react';
import Header from '../../components/layout/Header';
import OutletCard from '../../components/food/OutletCard';
import { useAuth } from '../../hooks/useAuth';
import { catalogService } from '../../services/catalog/catalogService';
import { CardSkeleton } from '../../components/ui/Skeleton';

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

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Welcome back, {user?.name || 'Student'}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
            Explore <span className="text-primary">Outlets</span>
          </h1>
          <p className="text-base text-muted-foreground mt-2">Order from your favorite campus outlets</p>
        </motion.div>

        {/* Search + filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row gap-3 mb-10"
        >
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="text"
              className="w-full pl-12 pr-4 py-3.5 bg-card border border-input rounded-2xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
              placeholder="Search outlets, cuisines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                className={`px-5 py-3.5 rounded-2xl text-sm font-medium transition-all ${
                  activeFilter === filter
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                    : 'bg-card border border-border text-foreground hover:bg-muted hover:border-primary/30'
                }`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2, 3, 4, 5].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : filteredOutlets.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.08 },
              },
            }}
          >
            {filteredOutlets.map((outlet) => (
              <motion.div
                key={outlet.id}
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
                }}
              >
                <OutletCard outlet={outlet} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-24"
          >
            <div className="inline-flex w-16 h-16 rounded-full bg-muted items-center justify-center mb-4">
              <Search className="text-muted-foreground" size={24} />
            </div>
            <p className="text-muted-foreground">No outlets found matching your criteria.</p>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Home;
