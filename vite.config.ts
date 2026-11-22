import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null,
        includeAssets: [
          'favicon.png',
          'apple-touch-icon.png',
          'icon-192.png',
          'icon-512.png',
          'icon-maskable-512.png'
        ],
        manifest: {
          id: '/',
          name: 'تدبيرة — كل جنيه ليه قيمة',
          short_name: 'تدبيرة',
          description: 'تدبيرة — تطبيق أندرويد مصري أصيل لتدبير ميزانية البيت والأكل والمصاريف. وفّر بذكاء، ودبّر بيتك، وخلي كل جنيه في مكانه.',
          theme_color: '#D47E93',
          background_color: '#FFF8FA',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          lang: 'ar',
          dir: 'rtl',
          icons: [
            {
              src: '/favicon.png',
              sizes: '64x64',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Cache recipe photos after their first successful online load so
              // previously viewed dishes remain visible without connectivity.
              urlPattern: ({ request, url }) =>
                request.destination === 'image' || /\.(?:png|jpe?g|webp|avif)$/i.test(url.pathname),
              handler: 'CacheFirst',
              options: {
                cacheName: 'tadbeera-recipe-images-v1',
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] }
              }
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
