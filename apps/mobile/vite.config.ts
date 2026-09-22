import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg', 'icons/*.png', 'photos/*.svg'],
      manifest: {
        name: 'Room Alert Monitoring',
        short_name: 'RA Monitor',
        description: 'Outlet environment and security alert response app',
        theme_color: '#004a94',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // env.js carries the API URL the container injects, so it must never be precached.
        globIgnores: ['**/env.js'],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { dedupe: ['react', 'react-dom'] },
});
