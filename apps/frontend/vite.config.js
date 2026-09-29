import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
  build: {
    // Just raise the warning limit — the bundle includes all features
    // (admin, outlet, student, auth, payments, socket.io, toasts, etc.)
    // in one chunk. Code splitting can be added later with React.lazy().
    chunkSizeWarningLimit: 700,
  },
})
