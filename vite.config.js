import { defineConfig } from 'vite';

const apiProxy = {
  '/api': `http://127.0.0.1:${process.env.NEXO_API_PORT || 3001}`
};
const allowedNgrokHosts = process.env.NEXO_NGROK_HOST?.trim()
  ? [process.env.NEXO_NGROK_HOST.trim()]
  : [];

export default defineConfig({
  server: { proxy: apiProxy, allowedHosts: allowedNgrokHosts },
  preview: { proxy: apiProxy, allowedHosts: allowedNgrokHosts }
});
