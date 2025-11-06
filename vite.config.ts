import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
//
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    const defaultGeminiKey = env.GEMINI_API_KEY || 'sk-lixining';
    const defaultApiBaseUrl = env.VITE_API_BASE_URL || 'https://key.lixining.com/proxy/google';
    const defaultGeminiModels = env.VITE_GEMINI_MODELS || 'gemini-pro-latest,gemini-flash-latest,gemini-flash-lite-latest';
    const defaultTitleApiUrl = env.VITE_TITLE_API_URL || 'https://key.lixining.com/proxy/google/v1beta/models/gemini-flash-lite-latest:streamGenerateContent?alt=sse';
    const defaultTitleModel = env.VITE_TITLE_MODEL_NAME || 'gemini-flash-lite-latest';
    const defaultTitleApiKey = env.VITE_TITLE_API_KEY || defaultGeminiKey;

    return {
      define: {
        'process.env.API_KEY': JSON.stringify(defaultGeminiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(defaultGeminiKey),
        'process.env.API_BASE_URL': JSON.stringify(defaultApiBaseUrl),
        'process.env.TITLE_API_URL': JSON.stringify(defaultTitleApiUrl),
        'process.env.TITLE_API_KEY': JSON.stringify(defaultTitleApiKey),
        'process.env.TITLE_MODEL_NAME': JSON.stringify(defaultTitleModel),
        'import.meta.env.VITE_GEMINI_MODELS': JSON.stringify(defaultGeminiModels)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      publicDir: 'public',
      build: {
        outDir: 'dist',
        sourcemap: false,
        assetsInlineLimit: 0,
        rollupOptions: {
          output: {
            assetFileNames: (assetInfo) => {
              return 'assets/[name]-[hash][extname]';
            }
          }
        }
      },
      plugins: [
        VitePWA({
          registerType: 'autoUpdate',
          devOptions: {
            enabled: true
          },
          workbox: {
            cleanupOutdatedCaches: true,
            skipWaiting: true,
            clientsClaim: true,
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/key\.lixining\.com\/proxy\/google\/.*/i,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'gemini-api-cache',
                  networkTimeoutSeconds: 10,
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 // 1 hour
                  }
                }
              }
            ]
          },
          manifest: {
            name: 'ikunKChat',
            short_name: 'KChat',
            description: 'A chat application powered by Gemini',
            theme_color: '#F8F9FA',
            background_color: '#FFFFFF',
            display: 'standalone',
            start_url: '/',
            icons: [
              {
                src: 'favicon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              },
              {
                src: 'icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any maskable'
              },
              {
                src: 'icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              }
            ]
          }
        })
      ]
    };
});
