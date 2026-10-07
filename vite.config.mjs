import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({ jsxRuntime: 'classic' })],
  server: {
    proxy: {
      '/query': 'http://127.0.0.1:3001',
      '/traverse': 'http://127.0.0.1:3001',
      '/connection': 'http://127.0.0.1:3001',
      '/health': 'http://127.0.0.1:3001'
    }
  },
  test: {
    environment: 'jsdom',
    globals: false
  }
});
