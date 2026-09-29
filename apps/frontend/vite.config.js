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
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Split vendor code into separate chunks for better caching.
        // Vite 8 (rolldown) requires a function, not an object.
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('react-router-dom')) {
            return 'react-vendor';
          }
          if (id.includes('react-hot-toast')) {
            return 'toast';
          }
          if (id.includes('socket.io-client')) {
            return 'socket';
          }
        },
      },
    },
  },
})
