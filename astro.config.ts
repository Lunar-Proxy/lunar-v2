import node from '@astrojs/node';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import playformCompress from '@playform/compress';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { execSync } from 'child_process';
import type { IncomingMessage, ServerResponse } from 'http';
import { normalizePath } from 'vite';
import type { Plugin } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { version } from './package.json';

wisp.options.wisp_version = 2;
const iconURL = 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64';

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
        if (req.url?.startsWith('/w')) wisp.routeRequest(req, socket, head);
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
        if (!iconUrl) return res.end('URL parameter is required.');

        try {
          const response = await fetch(`${iconURL}&url=${encodeURIComponent(iconUrl)}`);
          if (!response.ok) return res.end('Failed to fetch favicon.');
          const buffer = Buffer.from(await response.arrayBuffer());
          res.setHeader('Content-Type', 'image/jpeg');
          res.end(buffer);
        } catch {
          res.statusCode = 500;
          res.end('Internal server error.');
        }
      });
    },
  };
}

function searchBackend(): Plugin {
  return {
    name: 'vite-query-middleware',
    configureServer({ middlewares }) {
      middlewares.use('/api/query', async (req: IncomingMessage, res: ServerResponse) => {
        const urlObj = new URL(req.url ?? '', 'http://localhost');
        const query = urlObj.searchParams.get('q');
        if (!query) return res.end('Query parameter "q" is required.');

        try {
          const response = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
          });
          if (!response.ok) return res.end('Failed to fetch suggestions.');
          const suggestions = await response.json();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(suggestions));
        } catch {
          res.statusCode = 500;
          res.end('Internal server error.');
        }
      });
    },
  };
}

export default defineConfig({
  integrations: [playformCompress()],
  output: 'server',
  adapter: node({ mode: 'middleware' }),
  prefetch: { prefetchAll: true, defaultStrategy: 'load' },
  vite: {
    optimizeDeps: { include: ['lucide'] },
    define: {
      VERSION: JSON.stringify(version),
      UPDATE_DATE: JSON.stringify(getDate()),
    },
    plugins: [
      tailwindcss(),
      WispServer(),
      IconBackend(),
      searchBackend(),
      viteStaticCopy({
        targets: [
          { src: normalizePath(`${libcurlPath}/**/*.mjs`), dest: 'lc', overwrite: false },
          { src: normalizePath(`${baremuxPath}/**/*.js`), dest: 'bm', overwrite: false },
        ],
      }) as any,
    ],
    server: { fs: { strict: false } },
    build: { minify: 'esbuild', sourcemap: false },
  },
});
