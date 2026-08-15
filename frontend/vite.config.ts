import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// Vite dev server runs on 5173 (matches backend CLIENT_ORIGIN).
// /api and /health are proxied to the Express backend on 4000 so the browser
// treats API calls as same-origin — this keeps HttpOnly auth cookies and the
// CSRF double-submit flow working without cross-site cookie restrictions.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split large, stable vendor libs into their own cacheable chunks.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query', 'axios'],
          motion: ['gsap', '@gsap/react', 'lenis'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/health': 'http://localhost:4000',
      '/ready': 'http://localhost:4000',
    },
  },
});
