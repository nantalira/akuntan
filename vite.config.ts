import path from 'node:path';
import devServer from '@hono/vite-dev-server';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Akuntan AI - Asisten Keuangan Pribadi',
        short_name: 'Akuntan AI',
        description: 'Pencatatan pengeluaran harian cerdas dengan Hono dan Cloudflare D1',
        theme_color: '#10b981',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    }),
    devServer({
      entry: 'src/server/index.ts',
      exclude: [
        /^\/(src|node_modules|@vite|@react-refresh)/,
        /^\/(index\.html|favicon\.svg)/,
        /.*\.(tsx|ts|jsx|js|css|json|svg|png|jpg|ico)$/
      ]
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist'
  }
});
