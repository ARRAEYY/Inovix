import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';
import { useRealtime } from './hooks/useRealtime';
import { useAuth } from './hooks/useAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 1 min stale time — short enough for realtime updates to feel fresh,
      // long enough to avoid hammering the API on tab focus.
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry on auth errors — the client interceptor handles refresh
        if (error?.response?.status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});

function RealtimeBridge() {
  const { isAuthenticated } = useAuth();
  useRealtime(isAuthenticated);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeBridge />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
