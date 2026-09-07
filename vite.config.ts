import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Plain HTTP by default — enough for localhost, and required behind a
// Cloudflare tunnel (the tunnel terminates TLS in front, local origin stays
// http). AudioWorklet (the audio engine) is a secure-context-only API, so
// for direct LAN-IP access serve self-signed HTTPS instead:
// `npm run dev:https` (or HTTPS=1 vite) — accept the one-time warning
// (Advanced → Proceed) when opening https://<lan-ip>:<port>; the cert is
// self-signed for *.localhost.
const https = process.env.HTTPS === '1';

export default defineConfig({
  plugins: https ? [basicSsl()] : [],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
