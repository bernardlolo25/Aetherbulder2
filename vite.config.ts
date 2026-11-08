import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import handler from './api/index.ts';

function aetherApiPlugin(): Plugin {
  return {
    name: 'aether-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '', 'http://localhost:3000');
        if (url.pathname === '/api.php' || url.pathname === '/api' || url.pathname.startsWith('/api/')) {
          const chunks: any[] = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', async () => {
            let body: any = {};
            const rawBody = Buffer.concat(chunks).toString('utf8');
            if (rawBody) {
              try {
                body = JSON.parse(rawBody);
              } catch {
                body = rawBody;
              }
            }

            const query: Record<string, string> = {};
            url.searchParams.forEach((val, key) => {
              query[key] = val;
            });

            const vercelReq: any = Object.assign(req, {
              query,
              body,
              url: req.url,
            });

            const vercelRes: any = Object.assign(res, {
              status(code: number) {
                res.statusCode = code;
                return vercelRes;
              },
              json(obj: any) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(obj));
                return vercelRes;
              },
              send(data: any) {
                res.end(data);
                return vercelRes;
              },
            });

            try {
              await handler(vercelReq, vercelRes);
            } catch (err: any) {
              console.error('Aether API Error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Internal API Error' }));
            }
          });
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), aetherApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

