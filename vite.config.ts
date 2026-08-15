import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'HkTube — Signals worth following',
        short_name: 'HkTube',
        description: 'An original video platform for ideas, craft, and curious minds.',
        theme_color: '#0b0e13',
        background_color: '#0b0e13',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
})
