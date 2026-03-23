import fastifyCompress from '@fastify/compress';
import fastifyHelmet from '@fastify/helmet';
import fastifyMiddie from '@fastify/middie';
import fastifyStatic from '@fastify/static';
import type { FastifyStaticOptions, SetHeadersResponse } from '@fastify/static';
import { logging, server as wisp } from '@mercuryworkshop/wisp-js/server';
import chalk from 'chalk';
import Fastify from 'fastify';
import { execSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateChecker } from 'serverlib/check';
import { findProvider } from 'serverlib/provider';
import { version } from './package.json' with { type: 'json' };

EventEmitter.defaultMaxListeners = 20;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 6060;
const playsFile = path.join(process.cwd(), 'plays.json');

logging.set_level(logging.ERROR);

Object.assign(wisp.options, {
  dns_method: 'resolve',
  dns_servers: ['1.1.1.3', '1.0.0.3'],
  dns_result_order: 'ipv4first',
  wisp_version: 2,
  wisp_motd: 'wisp server',
});

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
  if (!fs.existsSync(playsFile)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(playsFile, 'utf-8'));
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writePlays(data: Record<string, number>): void {
  fs.writeFileSync(playsFile, JSON.stringify(data, null, 2));
}

if (!fs.existsSync('dist')) {
  console.log(chalk.hex('#f39c12')('Building Lunar...'));
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log(chalk.hex('#2ecc71')('Build completed successfully!'));
  } catch (error) {
    console.error(chalk.red('Build failed:'), error);
    process.exit(1);
  }
} else {
  console.log(chalk.hex('#3498db')('Lunar is already built, skipping...'));
}

const app = Fastify({
  logger: false,
  serverFactory: handler => {
    const server = createServer();
    server.setMaxListeners(50);
    server.on('request', (req, res) => handler(req, res));
    server.on('upgrade', (req, socket, head) => {
      if (req.url?.endsWith('/w/')) {
        wisp.routeRequest(req, socket as any, head);
      } else {
        socket.destroy();
      }
    });
    return server;
  },
});

await app.register(fastifyHelmet, {
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  contentSecurityPolicy: false,
});

await app.register(fastifyCompress, { encodings: ['gzip', 'deflate', 'br'] });

await app.register(fastifyMiddie);

const staticOpts: FastifyStaticOptions = {
  decorateReply: true,
  root: path.join(__dirname, 'dist', 'client'),
  setHeaders(res: SetHeadersResponse, filePath: string) {
    if (/\.(html?|astro)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      const hashed = /[.\-_][a-f0-9]{8,}\.(js|css|woff2?|png|jpe?g|svg|webp|gif)$/i.test(filePath);
      res.setHeader(
        'Cache-Control',
        hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'
      );
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  },
};

await app.register(fastifyStatic, staticOpts);

app.get('/api/plays', () => readPlays());

app.post<{ Body: { name?: string } }>('/api/plays', async (req, reply) => {
  pruneHits();
  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ??
    req.headers['x-real-ip']?.toString() ??
    req.ip;
  if (limited(ip)) return reply.code(429).send({ error: 'Too many requests' });
  const name = req.body?.name;
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 100 ||
    !/^[\w\s\-'.]+$/i.test(name)
  ) {
    return reply.code(400).send({ error: 'Invalid name' });
  }
  const data = readPlays();
  if (!(name in data) && Object.keys(data).length >= 10_000) {
    return reply.code(403).send({ error: 'Limit reached' });
  }
  data[name] = (data[name] || 0) + 1;
  writePlays(data);
  return { ok: true };
});

app.get<{ Querystring: { q?: string } }>('/api/query', async (req, reply) => {
  const query = req.query.q;
  if (!query) return reply.code(400).send({ error: 'Query parameter "q" is required.' });
  try {
    const response = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    });
    if (!response.ok)
      return reply.code(response.status).send({ error: 'Failed to fetch suggestions.' });
    const data = await response.json();
    const suggestions = Array.isArray(data) ? data.map((d: any) => d.phrase).filter(Boolean) : [];
    return { suggestions };
  } catch (err) {
    console.error('Backend suggestion error:', err);
    return reply.code(500).send({ error: 'Internal server error.' });
  }
});

// @ts-ignore
const { handler } = await import('./dist/server/entry.mjs');
app.use(handler);

app.setNotFoundHandler((_, reply) => {
  const text = fs.existsSync('404') ? fs.readFileSync('404', 'utf8') : '404 Not Found';
  reply.type('text/plain').send(text);
});

app.listen({ host: '0.0.0.0', port }, err => {
  if (err) {
    console.error(chalk.red('Failed to start server:'), err);
    process.exit(1);
  }

  const update = updateChecker();

  type StatusKey = 'u' | 'n' | 'f';
  const statusMap: Record<
    StatusKey,
    { icon: string; text: string; color: string; extra?: string }
  > = {
    u: { icon: '✅', text: 'Up to date', color: '#2ecc71' },
    n: {
      icon: '❌',
      text: `Update available (${update.commitId})`,
      color: '#f1c40f',
      extra: chalk.hex('#95a5a6')('→ https://github.com/lunar-proxy/lunar-v2/wiki'),
    },
    f: { icon: '❌', text: 'Failed to check for updates', color: '#e74c3c' },
  };

  const key = (['u', 'n', 'f'].includes(update.status) ? update.status : 'f') as StatusKey;
  const status = statusMap[key];
  const url = findProvider(port);
  console.log();
  console.log(chalk.hex('#8e44ad').bold('╭────────────────────────────────────────────╮'));
  console.log(
    chalk.hex('#8e44ad').bold('│ ') +
      chalk.hex('#f39c12').bold('🌙 Lunar v2 Server Started') +
      '                │'
  );
  console.log(chalk.hex('#8e44ad').bold('╰────────────────────────────────────────────╯'));
  console.log();
  console.log(chalk.hex('#00cec9')('Information:'));
  console.log(
    chalk.hex('#bdc3c7')('   ├─ ') +
      chalk.hex('#ecf0f1')('Version: ') +
      chalk.hex('#f39c12')(`v${version}`)
  );
  console.log(
    chalk.hex('#bdc3c7')('   └─ ') +
      chalk.hex('#ecf0f1')('Up to date: ') +
      chalk.hex(status.color)(`${status.icon} ${status.text}`)
  );
  if (status.extra) console.log('       ' + status.extra);
  console.log();
  console.log(chalk.hex('#00b894')('Access Information:'));
  if (url) {
    console.log(
      chalk.hex('#bdc3c7')('   ├─ ') +
        chalk.hex('#ecf0f1')('Deployment URL: ') +
        chalk.hex('#0984e3').underline(url)
    );
    console.log(
      chalk.hex('#bdc3c7')('   └─ ') +
        chalk.hex('#ecf0f1')('Hosting Method: ') +
        chalk.hex('#95a5a6')('Cloud Hosting')
    );
  } else {
    console.log(
      chalk.hex('#bdc3c7')('   ├─ ') +
        chalk.hex('#ecf0f1')('Local: ') +
        chalk.hex('#00cec9').underline(`http://localhost:${port}`)
    );
    console.log(
      chalk.hex('#bdc3c7')('   ├─ ') +
        chalk.hex('#ecf0f1')('Network: ') +
        chalk.hex('#00cec9').underline(`http://127.0.0.1:${port}`)
    );
    console.log(
      chalk.hex('#bdc3c7')('   └─ ') +
        chalk.hex('#ecf0f1')('Hosting Method: ') +
        chalk.hex('#95a5a6')('Self Hosting')
    );
  }
  console.log();
  console.log(chalk.hex('#8e44ad').bold('──────────────────────────────────────────────'));
  console.log();
});
