import fastifyCompress from '@fastify/compress';
import fastifyHelmet from '@fastify/helmet';
import fastifyMiddie from '@fastify/middie';
import fastifyStatic from '@fastify/static';
import type { FastifyStaticOptions, SetHeadersResponse } from '@fastify/static';
import { logging, server as wisp } from '@mercuryworkshop/wisp-js/server';
import chalk from 'chalk';
import Fastify from 'fastify';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateChecker } from 'serverlib/check';
import { findProvider } from 'serverlib/provider';

import { version } from './package.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 6060;

logging.set_level(logging.ERROR);
Object.assign(wisp.options, {
  dns_method: 'resolve',
  dns_servers: ['1.1.1.3', '1.0.0.3'],
  dns_result_order: 'ipv4first',
  wisp_version: 2,
  wisp_motd: 'wisp server',
});

async function ensureBuild() {
  if (!fs.existsSync('dist')) {
    console.log(chalk.hex('#f39c12')('🚀 Building Lunar...'));
    try {
      execSync('npm run build', { stdio: 'inherit' });
      console.log(chalk.hex('#2ecc71')('✅ Build completed successfully!'));
    } catch (error) {
      console.error(chalk.red('Build failed:'), error);
      process.exit(1);
    }
  } else {
    console.log(chalk.hex('#3498db')('Lunar is already built, skipping...'));
  }
}

const app = Fastify({
  logger: false,
  serverFactory: handler => {
    const server = createServer();
    const requestHandler = (req: any, res: any) => handler(req, res);
    const upgradeHandler = (req: any, socket: any, head: any) => {
      if (req.url?.endsWith('/w/')) {
        wisp.routeRequest(req, socket, head);
      } else {
        socket.destroy();
      }
    };
    server.on('request', requestHandler);
    server.on('upgrade', upgradeHandler);
    return server;
  },
});

await ensureBuild();

await app.register(fastifyHelmet, {
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  contentSecurityPolicy: false,
  xPoweredBy: false,
});

await app.register(fastifyCompress, {
  encodings: ['gzip', 'deflate', 'br'],
});

await app.register(fastifyMiddie);

const staticFileOptions: FastifyStaticOptions = {
  decorateReply: true,
  setHeaders(res: SetHeadersResponse, filePath: string) {
    const hashed = /\.[a-f0-9]{8,}\.(js|css|woff2?|png|jpe?g|svg|webp|gif)$/i.test(filePath);
    res.setHeader(
      'Cache-Control',
      hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  },
  root: path.join(__dirname, 'dist', 'client'),
};
await app.register(fastifyStatic, staticFileOptions);

app.use('/api/query', async (req: any, res: any) => {
  const urlObj = new URL(req.url ?? '', 'http://localhost');
  const search = urlObj.searchParams.get('q');
  if (!search) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Query parameter "q" is required.' }));
    return;
  }
  try {
    const response = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(search)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    });
    if (!response.ok) {
      res.statusCode = response.status;
      res.end(JSON.stringify({ error: 'Failed to fetch suggestions.' }));
      return;
    }
    const data = await response.json();
    const suggestions = Array.isArray(data) ? data.map((d: any) => d.phrase).filter(Boolean) : [];
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ suggestions }));
  } catch (err) {
    console.error('Backend suggestion error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error.' }));
  }
});

// @ts-ignore
const { handler } = await import('./dist/server/entry.mjs');
app.use(handler);

app.setNotFoundHandler((_, reply) => {
  const notFoundText = fs.existsSync('404') ? fs.readFileSync('404', 'utf8') : '404 Not Found';
  reply.type('text/plain').send(notFoundText);
});

app.listen({ host: '0.0.0.0', port }, err => {
  if (err) {
    console.error(chalk.red('Failed to start server:'), err);
    process.exit(1);
  }

  const updateStatus = updateChecker();
  type StatusKey = 'u' | 'n' | 'f';
  const statusMap: Record<
    StatusKey,
    { icon: string; text: string; color: string; extra?: string }
  > = {
    u: { icon: '✅', text: 'Up to date', color: '#2ecc71' },
    n: {
      icon: '❌',
      text: `Update available (${updateStatus.commitId})`,
      color: '#f1c40f',
      extra: chalk.hex('#95a5a6')('→ https://github.com/lunar-proxy/lunar-v2/wiki'),
    },
    f: { icon: '❌', text: 'Failed to check for updates', color: '#e74c3c' },
  };
  const statusKey = (
    ['u', 'n', 'f'].includes(updateStatus.status) ? updateStatus.status : 'f'
  ) as StatusKey;
  const status = statusMap[statusKey];
  const deploymentURL = findProvider(port);

  console.log();
  console.log(chalk.hex('#8e44ad').bold('╭────────────────────────────────────────────╮'));
  console.log(
    chalk.hex('#8e44ad').bold('│ ') +
      chalk.hex('#f39c12').bold('🌙 Lunar v2 Server Started') +
      '                │',
  );
  console.log(chalk.hex('#8e44ad').bold('╰────────────────────────────────────────────╯'));
  console.log();
  console.log(chalk.hex('#00cec9')('Information:'));
  console.log(
    chalk.hex('#bdc3c7')('   ├─ ') +
      chalk.hex('#ecf0f1')('Version: ') +
      chalk.hex('#f39c12')(`v${version}`),
  );
  console.log(
    chalk.hex('#bdc3c7')('   └─ ') +
      chalk.hex('#ecf0f1')('Up to date: ') +
      chalk.hex(status.color)(`${status.icon} ${status.text}`),
  );
  if (status.extra) console.log('       ' + status.extra);
  console.log();
  console.log(chalk.hex('#00b894')('Access Information:'));
  if (deploymentURL) {
    console.log(
      chalk.hex('#bdc3c7')('   ├─ ') +
        chalk.hex('#ecf0f1')('Deployment URL: ') +
        chalk.hex('#0984e3').underline(deploymentURL),
    );
    console.log(
      chalk.hex('#bdc3c7')('   └─ ') +
        chalk.hex('#ecf0f1')('Hosting Method: ') +
        chalk.hex('#95a5a6')('Cloud Hosting'),
    );
  } else {
    console.log(
      chalk.hex('#bdc3c7')('   ├─ ') +
        chalk.hex('#ecf0f1')('Local: ') +
        chalk.hex('#00cec9').underline(`http://localhost:${port}`),
    );
    console.log(
      chalk.hex('#bdc3c7')('   ├─ ') +
        chalk.hex('#ecf0f1')('Network: ') +
        chalk.hex('#00cec9').underline(`http://127.0.0.1:${port}`),
    );
    console.log(
      chalk.hex('#bdc3c7')('   └─ ') +
        chalk.hex('#ecf0f1')('Hosting Method: ') +
        chalk.hex('#95a5a6')('Self Hosting'),
    );
  }
  console.log();
  console.log(chalk.hex('#8e44ad').bold('──────────────────────────────────────────────'));
  console.log();
});
