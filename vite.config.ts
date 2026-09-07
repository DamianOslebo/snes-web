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
  // A Cloudflare tunnel forwards the public Host header (e.g.
  // snes.summers-home-lab.net), which Vite 5.4's default check —
  // localhost and IP addresses only — would reject with "Blocked request".
  // The leading-dot entry is Vite's wildcard form: the domain plus any
  // subdomain of it. (Use `allowedHosts: true` to allow any host, e.g. a
  // *.trycloudflare.com quick tunnel.)
  server: {
    port: 5173,
    allowedHosts: ['.summers-home-lab.net'],
  },
  preview: {
    allowedHosts: ['.summers-home-lab.net'],
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
