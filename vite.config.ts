import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  server: { host: '127.0.0.1', port: 8080, strictPort: true, watch: { ignored: ['**/backend/**'] }, proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false } } },
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
