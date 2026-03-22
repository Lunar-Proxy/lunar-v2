import node from '@astrojs/node';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import playformCompress from '@playform/compress';
import tailwindcss from '@tailwindcss/vite';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { defineConfig } from 'astro/config';
import type { IncomingMessage, ServerResponse } from 'http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizePath } from 'vite';
import type { Plugin } from 'vite';
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { version } from './package.json';

wisp.options.wisp_version = 2;
const IS_STATIC = process.argv.includes('--static');
const wispFlag = process.argv.indexOf('--wisp');
const wispUrl =
  process.argv.indexOf('--wisp') !== -1 ? process.argv[wispFlag + 1] : 'wss://lunaron.top/w/';

function WispServer(): Plugin {
  return {
    name: 'vite-wisp-server',
    configureServer(server: any) {
      server.httpServer?.on('upgrade', (req: IncomingMessage, socket: any, head: any) => {
        if (req.url?.endsWith('/w/')) {
          wisp.routeRequest(req, socket, head);
        }
      });
    },
  };
}
function searchBackend(): Plugin {
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
          const response = await fetch(
            `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}`,
            { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } }
          );
          if (!response.ok) {
            res.statusCode = response.status;
            res.end(JSON.stringify({ error: 'Failed to fetch suggestions.' }));
            return;
          }
          const data = (await response.json()) as Array<{ phrase: string }>;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ suggestions: data.map(d => d.phrase).filter(Boolean) }));
        } catch (err) {
          console.error('Backend suggestion error:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Internal server error.' }));
        }
      });
    },
  };
}

function playsBackend(): Plugin {
  const playsFile = join(process.cwd(), 'plays.json');
  const hits = new Map<string, { count: number; resetAt: number }>();
  let lastPrune = Date.now();

  function pruneHits() {
    const now = Date.now();
    if (now - lastPrune < 60_000) return;
    lastPrune = now;
    for (const [ip, entry] of hits.entries()) {
      if (now > entry.resetAt) hits.delete(ip);
    }
  }

  function limited(ip: string): boolean {
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + 60_000 });
      return false;
    }
    if (entry.count >= 10) return true;
    entry.count++;
    return false;
  }

  function readPlays(): Record<string, number> {
    if (!existsSync(playsFile)) return {};
    try {
      const parsed = JSON.parse(readFileSync(playsFile, 'utf-8'));
      if (typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return parsed;
    } catch {
      return {};
    }
  }

  return {
    name: 'vite-plays-backend',
    configureServer({ middlewares }) {
      middlewares.use('/api/plays', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(readPlays()));
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        pruneHits();
        const ip =
          (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ??
          req.headers['x-real-ip'] ??
          req.socket.remoteAddress ??
          'unknown';
        if (limited(ip)) {
          res.statusCode = 429;
          res.end(JSON.stringify({ error: 'Too many requests' }));
          return;
        }

        let body = '';
        for await (const chunk of req) body += chunk;
        let parsed: any;
        try {
          parsed = JSON.parse(body);
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        const name = parsed?.name;
        if (
          typeof name !== 'string' ||
          !name.trim() ||
          name.length > 100 ||
          !/^[\w\s\-'.]+$/i.test(name)
        ) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid name' }));
          return;
        }

        const plays = readPlays();
        if (!(name in plays) && Object.keys(plays).length >= 10_000) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Limit reached' }));
          return;
        }

        plays[name] = (plays[name] || 0) + 1;
        writeFileSync(playsFile, JSON.stringify(plays, null, 2));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
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
          collapseBooleanAttributes: true,
          collapseWhitespace: true,
          conservativeCollapse: false,
          customAttrAssign: [/\?=/],
          customAttrCollapse: /\s+/,
          customEventAttributes: [/^on[a-z]{3,}$/],
          decodeEntities: true,
          html5: true,
          ignoreCustomComments: [/^!/, /^\s*ko/],
          ignoreCustomFragments: [/<%[\s\S]*?%>/, /<\?[\s\S]*?\?>/],
          keepClosingSlash: false,
          maxLineLength: 0,
          minifyCSS: true,
          minifyJS: true,
          minifyURLs: true,
          preserveLineBreaks: false,
          preventAttributesEscaping: false,
          processConditionalComments: true,
          processScripts: ['text/html'],
          quoteCharacter: '"',
          removeAttributeQuotes: true,
          removeComments: true,
          removeEmptyAttributes: true,
          removeEmptyElements: true,
          removeOptionalTags: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          removeTagWhitespace: true,
          sortAttributes: true,
          sortClassName: true,
          trimCustomFragments: true,
          useShortDoctype: true,
        },
      },
      Image: false, // gave big fat error fatass
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
    },
    define: {
      VERSION: JSON.stringify(version),
      STATIC: JSON.stringify(IS_STATIC),
      WURL: JSON.stringify(wispUrl),
    },
    plugins: [
      tailwindcss(),
      WispServer(),
      searchBackend(),
      playsBackend(),
      obfuscatorPlugin({
        include: ['**/client/**', '**/_astro/**'],
        exclude: [
          'tmp/**',
          'data/**',
          '**/tmp/**',
          '**/data/**',
          'node_modules/**',
          '**/node_modules/**',
          '**/server/**',
          '**/chunks/**',
          '**/entry.*',
          '**/renderers.*',
          '**/manifest*',
        ],
        apply: 'build',
        debugger: false,
        options: {
          compact: true,
          simplify: true,
          target: 'browser',
          sourceMap: false,
          seed: OBFUSCATOR_SEED,
          log: false,
          identifierNamesGenerator: 'hexadecimal',
          renameGlobals: false,
          renameProperties: false,
          transformObjectKeys: true,
          ignoreImports: true,
          stringArray: true,
          stringArrayThreshold: 0.5,
          stringArrayEncoding: ['base64'],
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayIndexShift: true,
          stringArrayWrappersCount: 1,
          stringArrayWrappersType: 'variable',
          stringArrayCallsTransform: false,
          splitStrings: true,
          splitStringsChunkLength: 8,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.5,
          deadCodeInjection: false,
          selfDefending: true,
          debugProtection: false,
          disableConsoleOutput: true,
          numbersToExpressions: true,
          unicodeEscapeSequence: false,
        },
      }),
      viteStaticCopy({
        targets: [
          { src: normalizePath(`${libcurlPath}/**/*.mjs`), dest: 'lc', overwrite: false },
          { src: normalizePath(`${baremuxPath}/**/*.js`), dest: 'bm', overwrite: false },
          { src: normalizePath(`${epoxyPath}/**/*.js`), dest: 'ep', overwrite: false },
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
            src: [normalizePath(`${uvPath}/*.js`), '!' + normalizePath(`${uvPath}/sw.js`)],
            dest: 'tmp',
            rename: (name: string) => `${name.replace(/^uv\./, '')}.js`,
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
