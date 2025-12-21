import node from '@astrojs/node';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import playformCompress from '@playform/compress';
import tailwindcss from '@tailwindcss/vite';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { defineConfig } from 'astro/config';
import { execSync } from 'child_process';
import type { IncomingMessage, ServerResponse } from 'http';
import { normalizePath } from 'vite';
import type { Plugin } from 'vite';
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { version } from './package.json';

wisp.options.wisp_version = 2;

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
        if (req.url?.startsWith('/w/')) wisp.routeRequest(req, socket, head);
      });
    },
  };
}

function IconBackend(): Plugin {
  const faviconApi = 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64';
  return {
    name: 'vite-icon-middleware',
    configureServer({ middlewares }) {
      middlewares.use('/api/icon', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const urlObj = new URL(req.url ?? '', 'http://localhost');
          const targetUrl = urlObj.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.end('URL parameter is required.');
            return;
          }
          const response = await fetch(`${faviconApi}&url=${encodeURIComponent(targetUrl)}`);
          if (!response.ok) {
            res.statusCode = response.status;
            res.end('Failed to fetch favicon.');
            return;
          }
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const contentType = response.headers.get('content-type') || 'image/png';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.end(buffer);
        } catch (err) {
          console.error('Icon error:', err);
          res.statusCode = 500;
          res.end('Internal server error.');
        }
      });
    },
  };
}

export function searchBackend(): Plugin {
  return {
    name: 'search-suggestions-vite',
    configureServer({ middlewares }) {
      middlewares.use('/api/query', async (req: IncomingMessage, res: ServerResponse) => {
        const urlObj = new URL(req.url ?? '', 'http://localhost');
        const query = urlObj.searchParams.get('q');

        if (!query) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Query parameter "q" is required.' }));
          return;
        }

        try {
          const response = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0',
              Accept: 'application/json',
            },
          });

          if (!response.ok) {
            res.statusCode = response.status;
            res.end(JSON.stringify({ error: 'Failed to fetch suggestions.' }));
            return;
          }

          const data = (await response.json()) as Array<{ phrase: string }>;
          const suggestions = data.map(d => d.phrase).filter(Boolean);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ suggestions }));
        } catch (err) {
          console.error('Backend suggestion error:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Internal server error.' }));
        }
      });
    },
  };
}

const OBFUSCATOR_SEED = Math.floor(Math.random() * 9999999);

export default defineConfig({
  integrations: [
    playformCompress({
      CSS: true,
      HTML: {
        'html-minifier-terser': {
                    caseSensitive: true,
                    conservativeCollapse: false,
                    customAttrAssign: [/\?=/],
                    customAttrCollapse: /\s+/,                  customEventAttributes: [/^on[a-z]{3,}$/],
                    html5: true,
                    ignoreCustomComments: [/^!/, /^\s*ko/],
                    ignoreCustomFragments: [/<%[\s\S]*?%>/, /<\?[\s\S]*?\?>/],
                    maxLineLength: 0,
                    preserveLineBreaks: false,
                    preventAttributesEscaping: false,
                    processScripts: ["text/html"],
                    quoteCharacter: '"',
                    removeAttributeQuotes: true,
                    removeRedundantAttributes: true,
                    removeStyleLinkTypeAttributes: true,
                    sortAttributes: true,
                    sortClassName: true,
                    trimCustomFragments: true,
                    useShortDoctype: true,
          collapseWhitespace: true,
          removeComments: true,
          removeEmptyAttributes: true,
          keepClosingSlash: false,
          minifyJS: true,
          minifyCSS: true,
          decodeEntities: true,
          collapseBooleanAttributes: true,
          removeOptionalTags: true,
          removeEmptyElements: true,
          minifyURLs: true,
          removeScriptTypeAttributes: true,
          processConditionalComments: true,
          removeTagWhitespace: true,
        },
      },
      Image: true,
      JavaScript: true,
      JSON: true,
      SVG: true,
    }),
  ],
  output: 'server',
  adapter: node({ mode: 'middleware' }),
  prefetch: { prefetchAll: true, defaultStrategy: 'load' },
  vite: {
    build: {
      minify: 'esbuild',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-wisp': ['@mercuryworkshop/wisp-js'],
            'vendor-mux': ['@mercuryworkshop/bare-mux'],
            'vendor-transport': ['@mercuryworkshop/libcurl-transport'],
            'vendor-lucide': ['lucide'],
          },
        },
      },
    },
    optimizeDeps: {
      include: ['lucide'],
      exclude: [],
    },
    define: {
      VERSION: JSON.stringify(version),
      UPDATE_DATE: JSON.stringify(getDate()),
    },  
    plugins: [
      tailwindcss(),
      WispServer(),
      IconBackend(),
      searchBackend(),
      obfuscatorPlugin({
        exclude: [
          'tmp/**',
          'data/**',
          '**/tmp/**',
          '**/data/**',
          'node_modules/**',
          '**/node_modules/**'
        ],
        apply: 'build',
        debugger: false,
        options: {
          compact: true,
          simplify: true,
          stringArray: true,
          splitStrings: true,
          splitStringsChunkLength: 12,
          stringArrayEncoding: [],
          stringArrayThreshold: 0.5,
          stringArrayIndexShift: true,
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayWrappersCount: 1,
          stringArrayWrappersType: 'variable',
          stringArrayWrappersChainedCalls: false,
          stringArrayWrappersParametersMaxCount: 2,
          stringArrayCallsTransform: false,
          identifierNamesGenerator: 'hexadecimal',
          ignoreImports: true,
          log: false,
          numbersToExpressions: false,
          renameGlobals: false,
          renameProperties: false,
          selfDefending: true,
          sourceMap: false,
          target: 'browser',
          transformObjectKeys: false,
          unicodeEscapeSequence: false,
          seed: OBFUSCATOR_SEED,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.3,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 0.2,
          debugProtection: false,
          disableConsoleOutput: false
        },
      }),
      viteStaticCopy({
        targets: [
          { src: normalizePath(`${libcurlPath}/**/*.mjs`), dest: 'lc', overwrite: false },
          { src: normalizePath(`${baremuxPath}/**/*.js`), dest: 'bm', overwrite: false },
          {
            src: [normalizePath(`${scramjetPath}/*.js`), normalizePath(`${scramjetPath}/*.wasm`)],
            dest: 'data',
            rename: (name: string) => {
              const ending = name.endsWith('.wasm') ? '.wasm' : '.js';
              return `${name.replace(/^scramjet\./, '')}${ending}`;
            },
            overwrite: false,
          },
          {
            src: [
              normalizePath(`${uvPath}/*.js`),
              '!' + normalizePath(`${uvPath}/sw.js`),
            ],
            dest: 'tmp',
            rename: (name: string) => {
              return `${name.replace(/^uv\./, '')}.js`;
            },
            overwrite: false,
          },
        ],
      }) as any, // DO NOT REMOVE "AS ANY"
    ],
    server: {
      host: true,
      allowedHosts: ['.localhost', '.trycloudflare.com'],
    },
  },
});