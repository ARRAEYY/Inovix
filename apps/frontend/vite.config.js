import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy /api/* and /socket.io/* to the backend so a single URL covers
    // everything (works for cloudflared tunneling too).
    proxy: {
      '/api':       { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', changeOrigin: true, ws: true },
    },
  },
})
