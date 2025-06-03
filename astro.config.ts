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
import { ViteMinifyPlugin } from 'vite-plugin-minify';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

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

function WispServer(): Plugin {
  return {
    name: 'vite-wisp-server',
    configureServer(server) {
      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (req.url?.startsWith('/w')) {
          wisp.routeRequest(req, socket, head);
        }
      });
    },
  };
}

function IconBackend(): Plugin {
  return {
    name: 'vite-icon-middleware',
    configureServer({ middlewares }) {
      middlewares.use('/api/icon', async (req: IncomingMessage, res: ServerResponse) => {
        const urlObj = new URL(req.url ?? '', 'http://localhost');
        const iconUrl = urlObj.searchParams.get('url');

        if (!iconUrl) {
          res.statusCode = 400;
          res.end('URL parameter is required.');
          return;
        }

        try {
          const response = await fetch(`${iconURL}&url=${encodeURIComponent(iconUrl)}`);
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
    },
  };
}

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'middleware' }),
  compressHTML: true,
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'load',
  },
  vite: {
    define: {
      VERSION: JSON.stringify(version),
      UPDATE_DATE: JSON.stringify(getDate()),
    },
    plugins: [
      tailwindcss(),
      ViteMinifyPlugin({
        collapseWhitespace: true,
        minifyCSS: true,
        minifyJS: true,
      }),
      WispServer(),
      IconBackend(),
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
