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
            {
              headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: 'application/json',
              },
            },
          );

          if (!response.ok) {
            res.statusCode = response.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Failed to fetch suggestions.' }));
            return;
          }

          const data = (await response.json()) as Array<{ phrase: string }>;
          const suggestions = data.map((d) => d.phrase).filter(Boolean);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ suggestions }));
        } catch (err) {
          console.error('Backend suggestion error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal server error.' }));
        }
      });
    },
  };
}

const OBFUSCATOR_SEED = Math.floor(Math.random() * 9_999_999);

export default defineConfig({
  integrations: [
    playformCompress({
      CSS: {
        csso: {
          comments: false,
          restructure: true,
          forceMediaMerge: true,
        },
      },
      HTML: {
        'html-minifier-terser': {
          caseSensitive: true,
          conservativeCollapse: false,
          customAttrAssign: [/\?=/],
          customAttrCollapse: /\s+/,
          customEventAttributes: [/^on[a-z]{3,}$/],
          html5: true,
          ignoreCustomComments: [/^!/, /^\s*ko/],
          ignoreCustomFragments: [/<%[\s\S]*?%>/, /<\?[\s\S]*?\?>/],
          maxLineLength: 0,
          preserveLineBreaks: false,
          preventAttributesEscaping: false,
          processScripts: ['text/html'],
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
      Image: false,
      JavaScript: {
        terser: {
          compress: {
            passes: 2,
            drop_console: true,
            drop_debugger: true,
            pure_getters: true,
            dead_code: true,
            hoist_funs: true,
            inline: 2,
            collapse_vars: true,
            reduce_vars: true,
            evaluate: true,
            sequences: true,
            negate_iife: true,
            keep_infinity: true,
          },
          mangle: {
            toplevel: false,
            safari10: false,
          },
          format: {
            comments: false,
            ascii_only: true,
          },
        },
      },
      JSON: true,
      SVG: {
        svgo: {
          multipass: true,
          plugins: [
            { name: 'preset-default' },
            { name: 'removeDoctype' },
            { name: 'removeXMLProcInst' },
            { name: 'removeComments' },
            { name: 'removeMetadata' },
            { name: 'removeEditorsNSData' },
            { name: 'cleanupAttrs' },
            { name: 'mergeStyles' },
            { name: 'inlineStyles' },
            { name: 'minifyStyles' },
            { name: 'cleanupIds' },
            { name: 'removeUselessDefs' },
            { name: 'cleanupNumericValues' },
            { name: 'convertColors' },
            { name: 'removeUnknownsAndDefaults' },
            { name: 'removeNonInheritableGroupAttrs' },
            { name: 'removeUselessStrokeAndFill' },
            { name: 'cleanupEnableBackground' },
            { name: 'removeHiddenElems' },
            { name: 'removeEmptyText' },
            { name: 'convertShapeToPath' },
            { name: 'convertEllipseToCircle' },
            { name: 'moveElemsAttrsToGroup' },
            { name: 'moveGroupAttrsToElems' },
            { name: 'collapseGroups' },
            { name: 'convertPathData' },
            { name: 'convertTransform' },
            { name: 'removeEmptyAttrs' },
            { name: 'removeEmptyContainers' },
            { name: 'mergePaths' },
            { name: 'removeUnusedNS' },
            { name: 'sortDefsChildren' },
            { name: 'removeDimensions' },
          ],
        },
      },
    }),
  ],
  output: 'server',
  adapter: node({ mode: 'middleware' }),
  prefetch: { prefetchAll: true, defaultStrategy: 'load' },
  vite: {
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          passes: 2,
          drop_console: true,
          drop_debugger: true,
          pure_getters: true,
          dead_code: true,
          hoist_funs: true,
          inline: 2,
          collapse_vars: true,
          reduce_vars: true,
          evaluate: true,
          sequences: true,
          negate_iife: true,
          keep_infinity: true,
        },
        mangle: {
          toplevel: false,
          safari10: false,
        },
        format: {
          comments: false,
          ascii_only: true,
        },
      },
      chunkSizeWarningLimit: 1000,
      cssMinify: 'lightningcss',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-lucide': ['lucide'],
          },
          compact: true,
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
      WispServer(),
      searchBackend(),
      obfuscatorPlugin({
        exclude: [
          'tmp/**',
          'data/**',
          '**/tmp/**',
          '**/data/**',
          'node_modules/**',
          '**/node_modules/**',
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
          transformObjectKeys: false,
          ignoreImports: true,
          stringArray: false,
          splitStrings: false,
          controlFlowFlattening: false,
          deadCodeInjection: false,
          selfDefending: true,
         // debugProtection: true,
        //  debugProtectionInterval: 0,
          disableConsoleOutput: true,
          numbersToExpressions: false,
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