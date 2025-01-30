import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { scramjetPath } from '@mercuryworkshop/scramjet';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { version } from './package.json';
import { execSync } from 'child_process';
import playformCompress from '@playform/compress';
import { uvPath } from 'uv';
export default defineConfig({
  output: 'static',
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
    prefetchAll: false,
    defaultStrategy: 'viewport',
  },
  vite: {
    define: {
      VERSION: JSON.stringify(version),
      LAST_UPDATED: JSON.stringify(
        execSync('git log -1 --format=%cd').toString().trim() ||
          'Failed to fetch.'
      ),
    },
    plugins: [
      {
        name: 'wisp-vite-server',
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
            src: `${epoxyPath}/**/*.mjs`.replace(/\\/g, '/'),
            dest: 'assets/packaged/ep',
            overwrite: false,
          },
          {
            src: `${baremuxPath}/**/*.js`.replace(/\\/g, '/'),
            dest: 'assets/packaged/bm',
            overwrite: false,
          },
          {
            src: `${scramjetPath}/**/*.js`.replace(/\\/g, '/'),
            dest: 'assets/packaged/scram',
            overwrite: false,
            rename: (name) => `${name.replace('scramjet.', '')}.js`,
          },
          {
            src: `${uvPath}/**/*.js`.replace(/\\/g, '/'),
            dest: 'assets/packaged/u',
            overwrite: false,
            rename: (name) => `${name.replace('uv.', '')}.js`,
          },
        ],
      }),
    ],
  },
});
