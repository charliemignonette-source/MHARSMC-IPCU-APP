import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    build: {
      outDir: 'dist',
    },
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: { enabled: true },
        workbox: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024 // 10MB
        },
        manifest: {
          name: 'IPC Guard',
          short_name: 'IPC Guard',
          description: 'MHARSMC Infection Prevention and Control Guard App',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'https://cdn.iconscout.com/icon/free/png-256/free-shield-2101344-1768820.png',
              sizes: '192x192',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
