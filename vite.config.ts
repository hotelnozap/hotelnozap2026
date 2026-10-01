import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'dev-api-send-push',
        configureServer(server) {
          server.middlewares.use('/api/send-push', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Método não permitido' }));
              return;
            }

            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const data = JSON.parse(body || '{}');
                const DEFAULT_KEY_B64 = 'b3NfdjJfYXBwX2ljYWphbXF6YXJmeHphZ2w2aHJvYWNtczZ0ZDdpcGV6NG9ldWl2NW4zdmY3dnhvcWZ3aHA1bnVuMzdycGxhN3JpZnhmaGNiZ2Yya2hmM3NhbXRmcmozcTU2NmRzbHh3NjV0Nmpwd2E=';
                const restApiKey = env.ONESIGNAL_REST_KEY || Buffer.from(DEFAULT_KEY_B64, 'base64').toString('utf-8');

                const payload: any = {
                  app_id: appId,
                  included_segments: data.segment === 'active' ? ['Active Subscriptions'] : ['Total Subscriptions'],
                  headings: { en: data.title, pt: data.title },
                  contents: { en: data.message, pt: data.message },
                  url: data.url || 'https://hotelnozap.com.br',
                  chrome_web_icon: 'https://hotelnozap.com.br/icon-192.png',
                  chrome_web_badge: 'https://hotelnozap.com.br/icon-192.png'
                };

                if (data.imageUrl) {
                  payload.chrome_web_image = data.imageUrl;
                  payload.big_picture = data.imageUrl;
                }

                const response = await fetch('https://onesignal.com/api/v1/notifications', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Authorization': `Basic ${restApiKey}`
                  },
                  body: JSON.stringify(payload)
                });

                const resData = await response.json();
                res.statusCode = response.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(resData));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Erro no servidor' }));
              }
            });
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
