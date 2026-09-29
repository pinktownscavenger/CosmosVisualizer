import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({ jsxRuntime: 'classic' })],
  server: {
    proxy: {
      '/query': 'http://localhost:3001',
      '/traverse': 'http://localhost:3001',
      '/connection': 'http://localhost:3001',
      '/health': 'http://localhost:3001'
    }
  },
  test: {
    environment: 'jsdom',
    globals: false
  }
});
