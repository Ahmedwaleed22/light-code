import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Behind an HTTPS ingress the browser reaches the HMR socket on 443, not Vite's own port.
const hmrClientPort = process.env.HMR_CLIENT_PORT ? Number(process.env.HMR_CLIENT_PORT) : undefined;

export default defineConfig({
  plugins: [preact()],
  build: { target: 'es2022', reportCompressedSize: true },
  server: {
    allowedHosts: ['.dev.remote.ahmedwaleed.online'],
    hmr: hmrClientPort ? { clientPort: hmrClientPort } : undefined,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8080', ws: true },
    },
  },
});
