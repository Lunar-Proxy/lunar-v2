import node from '@astrojs/node';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import playformCompress from '@playform/compress';
import tailwindcss from '@tailwindcss/vite';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { defineConfig } from 'astro/config';
import type { IncomingMessage, ServerResponse } from 'http';
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { normalizePath } from 'vite';
import type { Plugin } from 'vite';
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { version } from './package.json';
wisp.options.wisp_version = 2;

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
            { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } },
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

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function fontGenerator(): Plugin {
  return {
    name: 'vite-font-generator',
    buildStart() {
      if (existsSync('public/f.ttf')) rmSync('public/f.ttf');
      if (existsSync('public/map.json')) rmSync('public/map.json');
      const src = readdirSync('public').find(f => /\.(ttf|otf)$/i.test(f) && f !== 'f.ttf');
      if (!src) {
        console.warn('[font] no source .ttf/.otf in public/');
        return;
      }
      const require = createRequire(import.meta.url);
      const opentype = require('opentype.js');
      const font = opentype.loadSync(`public/${src}`);
      const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)).filter(
        ch => !/[0-9]/.test(ch),
      );
      const pool = shuffle(Array.from({ length: ascii.length }, (_, i) => 0x4e00 + i));
      const map: Record<string, number> = {};
      ascii.forEach((ch, i) => {
        map[ch] = pool[i];
      });
      const glyphs: any[] = [font.glyphs.get(0)];
      for (const [ch, cp] of Object.entries(map)) {
        const g = font.charToGlyph(ch);
        if (!g || g.index === 0) continue;
        glyphs.push(
          new opentype.Glyph({
            name: `u${cp.toString(16)}`,
            unicode: cp,
            advanceWidth: g.advanceWidth,
            path: g.path,
          }),
        );
      }

      for (let i = 0; i <= 9; i++) {
        const g = font.charToGlyph(String(i));
        if (!g || g.index === 0) continue;
        glyphs.push(
          new opentype.Glyph({
            name: `d${i}`,
            unicode: 0x30 + i,
            advanceWidth: g.advanceWidth,
            path: g.path,
          }),
        );
      }
      const out = new opentype.Font({
        familyName: 'F',
        styleName: 'R',
        unitsPerEm: font.unitsPerEm,
        ascender: font.ascender,
        descender: font.descender,
        glyphs,
      });
      writeFileSync('public/f.ttf', Buffer.from(out.toArrayBuffer()));
      writeFileSync('public/map.json', JSON.stringify(map));
      console.log(`[font ob] done (${glyphs.length} glyphs)`);
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
            'vendor-lucide': ['lucide'],
          },
        },
      },
    },
    optimizeDeps: {
      include: ['lucide'],
    },
    define: {
      VERSION: JSON.stringify(version),
    },
    plugins: [
      tailwindcss(),
      fontGenerator(),
      WispServer(),
      searchBackend(),
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
