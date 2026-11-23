import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { visualizer } from 'rollup-plugin-visualizer';

/**
 * Plugin de sécurité : Éradique le mock WebSocket et tout script inline de dev
 * lors du build de production (élimine la nécessité de 'unsafe-inline' et prévient
 * toute fuite de code de débug en prod).
 */
function stripDevOnlyScriptsPlugin(): Plugin {
  return {
    name: 'strip-dev-only-scripts',
    apply: 'build',
    transformIndexHtml(html: string) {
      // Supprime le bloc encadré par <!-- DEV_ONLY_START --> et <!-- DEV_ONLY_END -->
      return html.replace(/<!--\s*DEV_ONLY_START\s*-->[\s\S]*?<!--\s*DEV_ONLY_END\s*-->/g, '');
    },
  };
}

export default defineConfig({
  base: process.env.VITEST ? '/' : './',
  plugins: [
      stripDevOnlyScriptsPlugin(),
      react(),
      tailwindcss(),
      ...(!process.env.VITEST ? [
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
          manifest: {
            id: './',
            name: 'PhysioTracker PRO',
            short_name: 'PhysioPro',
            description: "Suivi des effets résiduels d'entraînement, courbes EMA et préparation athlétique.",
            theme_color: '#0a0a0c',
            background_color: '#0a0a0c',
            display: 'standalone',
            start_url: './',
            scope: './',
            icons: [
              {
                src: 'pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'pwa-maskable-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            globIgnores: ['**/stats.html'],
          },
          devOptions: {
            enabled: false,
          },
        }),
        visualizer({
          filename: 'dist/stats.html',
          open: false,
          gzipSize: true,
          brotliSize: true,
        }),
      ] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/react-is/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'react-vendor';
            }
            if (id.includes('/node_modules/firebase/') || id.includes('/node_modules/@firebase/')) {
              return 'firebase-vendor';
            }
            if (
              id.includes('/node_modules/recharts/') ||
              id.includes('/node_modules/d3-') ||
              id.includes('/node_modules/victory-vendor/') ||
              id.includes('/node_modules/es-toolkit/') ||
              id.includes('/node_modules/@reduxjs/toolkit/') ||
              id.includes('/node_modules/immer/') ||
              id.includes('/node_modules/reselect/') ||
              id.includes('/node_modules/eventemitter3/') ||
              id.includes('/node_modules/use-sync-external-store/')
            ) {
              return 'recharts-vendor';
            }
            if (id.includes('/node_modules/lucide-react/')) {
              return 'icons-vendor';
            }
            if (id.includes('/node_modules/qrcode/')) {
              return 'qrcode-vendor';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
      hmr: false,
    },
});
