import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/hktube-icon-180.png', 'icons/hktube-icon-192.png', 'icons/hktube-icon-512.png'],
      manifest: {
        name: 'HkTube — Signals worth following',
        short_name: 'HkTube',
        description: 'An original video platform for ideas, craft, and curious minds.',
        theme_color: '#0b0e13',
        background_color: '#0b0e13',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/hktube-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/hktube-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
