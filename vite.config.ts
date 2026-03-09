import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['vdyou.com', 'www.vdyou.com', 'localhost'],
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    hmr: process.env.VITE_HMR_HOST
      ? { host: process.env.VITE_HMR_HOST, protocol: 'wss', clientPort: 443 }
      : true,
  },
})
