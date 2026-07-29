import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables (without the VITE_ prefix filter so we can access all)
  const env = loadEnv(mode, process.cwd(), '')

  // In dev, proxy /api requests to the backend.
  // Use VITE_API_BASE_URL to determine the target (strip /api suffix for the proxy target).
  const apiBaseUrl = env.VITE_API_BASE_URL || 'http://localhost:3000/api'
  const proxyTarget = apiBaseUrl.replace(/\/api$/, '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
