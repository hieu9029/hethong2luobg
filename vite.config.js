import { defineConfig } from 'vite';
// Preserve the browser-facing Host so the API can verify same-origin writes.
const apiProxy={target:'http://127.0.0.1:3001',changeOrigin:false};
export default defineConfig({
  server: {
    host: '0.0.0.0', port: 5173, strictPort: true,
    proxy: { '/api': apiProxy },
    fs: { strict: true, deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/data/**', '**/backups/**', '**/*.sqlite', '**/*.sqlite-*', '**/*.db', '**/*.db-*'] },
  },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true, proxy: { '/api': apiProxy } },
});
