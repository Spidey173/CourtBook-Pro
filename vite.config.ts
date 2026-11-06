import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/static/dist/',
  plugins: [react()],
  build: {
    outDir: 'static/dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5000',
      '/auth': 'http://127.0.0.1:5000',
      '/healthz': 'http://127.0.0.1:5000',
    },
  },
});
