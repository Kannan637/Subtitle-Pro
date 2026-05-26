import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const apiProxyTarget =
  process.env.VITE_DEV_API_PROXY_TARGET ||
  process.env.VITE_API_PROXY_TARGET ||
  'http://127.0.0.1:8000'

const apiProxy = {
  '/api': {
    target: apiProxyTarget,
    changeOrigin: true,
  },
  '/webhook': {
    target: apiProxyTarget,
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: apiProxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    proxy: apiProxy,
  },
})
