import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { buildProxyAwareGeminiUrl } from './config/geminiProxy';
//
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    const defaultGeminiKey = env.GEMINI_API_KEY || 'sk-lixining';
    const defaultApiBaseUrl = (env.VITE_API_BASE_URL || '/api/gemini').replace(/\/$/, '');
    const defaultGeminiModels = env.VITE_GEMINI_MODELS || 'gemini-pro-latest,gemini-flash-latest,gemini-flash-lite-latest';
    const defaultTitleApiUrl = env.VITE_TITLE_API_URL || buildProxyAwareGeminiUrl(
      defaultApiBaseUrl,
      '/v1beta/models/gemini-flash-lite-latest:streamGenerateContent',
      { alt: 'sse' }
    );
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
      server: {
        proxy: {
          '/api/gemini': {
            target: 'https://key.lixining.com/proxy/google',
            changeOrigin: true,
            configure: (proxy) => {
              proxy.on('proxyReq', (proxyReq, req) => {
                const originalUrl = req.url ? new URL(req.url, 'http://localhost') : null;
                const encodedPath = originalUrl?.searchParams.get('path');
                if (!encodedPath) {
                  return;
                }

                originalUrl.searchParams.delete('path');
                let decoded = encodedPath;
                try {
                  decoded = decodeURIComponent(encodedPath);
                } catch (error) {
                  console.warn('Vite proxy failed to decode Gemini path, using raw value:', error);
                }

                const [rawPath, rawSearch] = decoded.split('?');
                const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
                proxyReq.path = `${normalizedPath}${rawSearch ? `?${rawSearch}` : ''}`;
              });
            },
          },
        },
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
                urlPattern: ({ url }) =>
                  url.pathname === '/api/gemini' ||
                  url.pathname.startsWith('/api/gemini/') ||
                  url.href.startsWith('https://key.lixining.com/proxy/google/'),
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
