import { execSync } from 'child_process';
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { normalizePath } from 'vite';
import { version } from './package.json';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import type { IncomingMessage, ServerResponse } from 'http';
import { ViteMinifyPlugin } from 'vite-plugin-minify';

wisp.options.wisp_version = 2;

const iconURL =
  'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64';

function getDate(): string {
  try {
    return execSync('git log -1 --format=%cd', { stdio: 'pipe' }).toString().trim();
  } catch {
    return new Date().toISOString();
  }
}

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'middleware' }),
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'load',
  },
  vite: {
    define: {
      VERSION: JSON.stringify(version),
      LAST_UPDATED: JSON.stringify(getDate()),
    },
    plugins: [
      ViteMinifyPlugin({}),
      tailwindcss(),
      {
        name: 'viteserver',
        configureServer({ middlewares, httpServer }) {
          middlewares.use('/api/icon', async (req: IncomingMessage, res: ServerResponse) => {
            const urlObj = new URL(req.url ?? '', 'http://localhost');
            const iconUrl = urlObj.searchParams.get('url');

            if (!iconUrl) {
              res.statusCode = 400;
              res.end('URL parameter is required.');
              return;
            }

            try {
              const response = await fetch(`${iconURL}&url=${iconUrl}`);

              if (!response.ok) {
                res.statusCode = 500;
                res.end('Failed to fetch the favicon.');
                return;
              }

              const buffer = Buffer.from(await response.arrayBuffer());
              res.setHeader('Content-Type', 'image/jpeg');
              res.end(buffer);
            } catch (err) {
              console.error(err);
              res.statusCode = 500;
              res.end('Internal server error.');
            }
          });

          httpServer?.on('upgrade', (req, socket, head) => {
            if (req.url?.startsWith('/wisp/')) {
              wisp.routeRequest(req, socket, head);
            }
          });
        },
      },
      viteStaticCopy({
        targets: [
          {
            src: normalizePath(`${libcurlPath}/**/*.mjs`),
            dest: 'lc',
            overwrite: false,
          },
          {
            src: normalizePath(`${baremuxPath}/**/*.js`),
            dest: 'bm',
            overwrite: false,
          },
        ],
      }),
    ],
  },
});
