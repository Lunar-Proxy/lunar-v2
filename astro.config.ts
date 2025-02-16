import { execSync } from 'child_process';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { scramjetPath } from '@mercuryworkshop/scramjet';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import playformCompress from '@playform/compress';
import { defineConfig } from 'astro/config';
import { normalizePath } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { version } from './package.json';

function check() {
  try {
    return execSync('git log -1 --format=%cd', { stdio: 'pipe' })
      .toString()
      .trim();
  } catch {
    return new Date().toISOString();
  }
}
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'middleware' }),
  integrations: [
    tailwind(),
    playformCompress({
      CSS: false,
      HTML: true,
      Image: true,
      JavaScript: true,
      SVG: true,
    }),
  ],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'load',
  },
  vite: {
    define: {
      VERSION: JSON.stringify(version),
      LAST_UPDATED: JSON.stringify(check()),
    },
    plugins: [
      {
        name: 'viteserver',
        configureServer(server) {
          server.httpServer?.on('upgrade', (req, socket, head) => {
            if (req.url?.startsWith('/wsp/')) {
              wisp.routeRequest(req, socket, head);
            }
          });
        },
      },
      viteStaticCopy({
        targets: [
          {
            src: normalizePath(epoxyPath + '/**/*.mjs'),
            dest: 'assets/packaged/ep',
            overwrite: false,
          },
          {
            src: normalizePath(baremuxPath + '/**/*.js'),
            dest: 'assets/packaged/bm',
            overwrite: false,
          },
          {
            src: `${scramjetPath}/**/*.js`.replace(/\\/g, '/'),
            dest: 'assets/packaged/scram',
            overwrite: false,
            rename: (name) => `${name.replace('scramjet.', '')}.js`,
          },
        ],
      }),
    ],
  },
});
