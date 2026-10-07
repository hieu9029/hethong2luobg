import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    host: '0.0.0.0', port: 5173, strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3001' },
    fs: { strict: true, deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/data/**', '**/backups/**', '**/*.sqlite', '**/*.sqlite-*', '**/*.db', '**/*.db-*'] },
  },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' } },
});
