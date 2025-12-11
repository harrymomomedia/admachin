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
        server.middlewares.use('/api/auth/facebook/session', (_req, res) => {
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

        // AI API proxy - load the serverless function handler
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/api/ai-generate' && req.method === 'POST') {
            // Ensure environment variables are available for the handler
            if (!process.env.ANTHROPIC_API_KEY && process.env.VITE_ANTHROPIC_API_KEY) {
              process.env.ANTHROPIC_API_KEY = process.env.VITE_ANTHROPIC_API_KEY;
            }
            if (!process.env.OPENAI_API_KEY && process.env.VITE_OPENAI_API_KEY) {
              process.env.OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
            }
            if (!process.env.GOOGLE_API_KEY && process.env.VITE_GOOGLE_API_KEY) {
              process.env.GOOGLE_API_KEY = process.env.VITE_GOOGLE_API_KEY;
            }

            // Dynamically import the serverless function
            const handler = await import('./api/ai-generate');
            // Convert Node.js req/res to Vercel format
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              const vercelReq = {
                method: req.method,
                body: JSON.parse(body),
                headers: req.headers
              };
              const vercelRes = {
                status: (code: number) => {
                  res.statusCode = code;
                  return vercelRes;
                },
                json: (data: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                },
                setHeader: (name: string, value: string) => {
                  res.setHeader(name, value);
                },
                end: () => res.end()
              };
              await handler.default(vercelReq as any, vercelRes as any);
            });
          } else {
            next();
          }
        });
      }
    }
  ],
})
