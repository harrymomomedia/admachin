import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import * as fs from 'fs';
import * as path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    process.env.HTTPS ? basicSsl() : undefined,
    {
      name: 'api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/auth/facebook/session', (_req, res, _next) => {
          // Simulation of the serverless function for local dev
          // We must implement the TokenStorage read logic here as well
          const storageFile = path.resolve(process.cwd(), '.auth_store.json');

          let storedSession = null;
          try {
            if (fs.existsSync(storageFile)) {
              storedSession = JSON.parse(fs.readFileSync(storageFile, 'utf-8'));
            }
          } catch (e) { console.error('Simulated session read failed', e); }

          // Fallback to Env
          if (!storedSession) {
            const token = process.env.FB_ACCESS_TOKEN || process.env.VITE_DEFAULT_FB_TOKEN;
            const userName = process.env.FB_USER_NAME || process.env.VITE_DEFAULT_FB_USER_NAME || 'System User';
            if (token) {
              storedSession = {
                accessToken: token,
                tokenExpiry: Date.now() + (365 * 24 * 60 * 60 * 1000),
                userName: userName,
                userId: 'system_env_user'
              };
            }
          }

          if (!storedSession) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ isAuthenticated: false }));
            return;
          }

          const session = {
            isAuthenticated: true,
            teamName: 'Momomedia', // Team Context
            profile: {
              id: storedSession.userId,
              name: storedSession.userName,
              accessToken: storedSession.accessToken,
              tokenExpiry: storedSession.tokenExpiry
            }
          };

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(session));
        });
      }
    }
  ],
})
