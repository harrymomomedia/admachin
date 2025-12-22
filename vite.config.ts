import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { config as dotenvConfig } from 'dotenv';

// Load .env.local for server middleware
dotenvConfig({ path: '.env.local' });

// https://vite.dev/config/
export default defineConfig({
  // Proxy API requests to Express server in development
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    process.env.HTTPS ? basicSsl() : undefined,
  ],
})
