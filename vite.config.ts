import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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
  base: './',
  plugins: [
      stripDevOnlyScriptsPlugin(),
      react(),
      tailwindcss(),
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
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
      hmr: false,
    },
});
