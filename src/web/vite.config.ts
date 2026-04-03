import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend port: use WORKER_PORT env var or default to 8787 (Worker)
// Set BACKEND_PORT=3001 to use Express server instead
const backendPort = process.env.BACKEND_PORT || '8787'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
