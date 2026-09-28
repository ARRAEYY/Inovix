import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';

// Derive react-router's basename from Vite's `base` config so the app
// works whether served at the root (Vite dev server standalone) or
// behind the Next.js reverse-proxy at /inovix-app/ (preview iframe).
// `import.meta.env.BASE_URL` is Vite's resolved base — '/' in standalone,
// '/inovix-app/' under the proxy. Strip the trailing slash for react-router.
const routerBasename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={routerBasename}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App
