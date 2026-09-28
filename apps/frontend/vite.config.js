import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `base` is configurable via VITE_BASE_PATH so the same code works:
//   - Standalone on Render (default '/') — the static site is served at the root
//   - Behind the Next.js reverse-proxy locally (set VITE_BASE_PATH=/inovix-app/)
// react-router's basename in App.jsx reads import.meta.env.BASE_URL, so it
// auto-adapts. HMR is disabled when proxied (the websocket can't tunnel).
const basePath = process.env.VITE_BASE_PATH || '/'
const isProxied = basePath !== '/'

export default defineConfig({
  plugins: [react()],
  base: basePath,
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    hmr: !isProxied,
  },
})
