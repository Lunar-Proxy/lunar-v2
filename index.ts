import Fastify from 'fastify';
import fastifyCompress from '@fastify/compress';
import fastifyMiddie from '@fastify/middie';
import fastifyStatic from '@fastify/static';
import { logging, server as wisp } from '@mercuryworkshop/wisp-js/server';
import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { Socket } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateChecker } from 'serverlib/check';
import { version } from './package.json';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 6969;

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
  wisp_version: 2,
  dns_method: 'resolve',
  dns_servers: ['1.1.1.3', '1.0.0.3'],
  dns_result_order: 'ipv4first',
});

async function buildCode() {
  if (!fs.existsSync('dist')) {
    console.log(chalk.hex('#FF6B35')('🚀 Building Lunar...'));
    try {
      execSync('npm run build', { stdio: 'inherit' });
      console.log(chalk.hex('#00C896')('✅ Build completed successfully!'));
    } catch (error) {
      throw new Error(`Build failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    console.log(chalk.hex('#4ECDC4')('📦 Lunar is already built, skipping...'));
  }
}

const app = Fastify({
  logger: false,
  serverFactory: handler =>
    createServer(handler).on('upgrade', (req, socket: Socket, head) => {
      wisp.routeRequest(req, socket, head);
    }),
});

await app.register(fastifyCompress, {
  global: true,
  encodings: ['gzip', 'deflate', 'br'],
});

await buildCode();

const staticOptions = {
  maxAge: 31536000000,
  etag: true,
  lastModified: true,
  redirect: false,
  setHeaders(res: any, filePath: string) {
    if (/\.(js|css|jpg|jpeg|png|gif|ico|svg|webp|avif)$/.test(filePath))
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    else res.setHeader('Cache-Control', 'public, max-age=604800');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
  },
};

await app.register(fastifyStatic, {
  root: path.join(__dirname, 'dist', 'client'),
  preCompressed: true,
  ...staticOptions,
});

const { handler } = await import('./dist/server/entry.mjs');
await app.register(fastifyMiddie);
app.use(handler);

app.setNotFoundHandler((_, reply) => {
  const notFound = fs.existsSync('404') ? fs.readFileSync('404') : '404 Not Found';
  reply.type('text/plain').send(notFound);
});

app.listen({ host: '0.0.0.0', port }, async () => {
  const updateStatus = await updateChecker()
  const statusMap: any = {
    u: { icon: '✅', text: 'Up to date', color: '#00C896' },
    n: {
      icon: '🔄',
      text: `Update available (${updateStatus.commitId})`,
      color: '#F39C12',
      extra: chalk.hex('#95A5A6')('   → https://github.com/lunar-proxy/lunar-v2/wiki'),
    },
    f: { icon: '❌', text: 'Update check failed', color: '#E74C3C' },
  };
  const status = statusMap[updateStatus.status] || statusMap.f;
  const deploymentURL =
    process.env.RENDER_EXTERNAL_URL ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    (process.env.RAILWAY_STATIC_URL && `https://${process.env.RAILWAY_STATIC_URL}`) ||
    (process.env.FLY_APP_NAME && `https://${process.env.FLY_APP_NAME}.fly.dev`) ||
    (process.env.CODESPACES &&
      `https://${process.env.CODESPACE_NAME}-${port}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`) ||
    (process.env.GITPOD_WORKSPACE_URL &&
      process.env.GITPOD_WORKSPACE_URL.replace('https://', `https://${port}-`)) ||
    (process.env.REPL_ID && `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`) ||
    (process.env.KOYEB_APP_NAME && `https://${process.env.KOYEB_APP_NAME}.koyeb.app`) ||
    (process.env.GLITCH_PROJECT_ID && `https://${process.env.PROJECT_DOMAIN}.glitch.me`) ||
    (process.env.HEROKU_APP_NAME && `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`) ||
    (process.env.NETLIFY_DEV === 'true' && process.env.SITE_URL);
  console.log(chalk.hex('#9B59B6').bold('╭─────────────────────────────────────────────────╮'));
  console.log(
    chalk.hex('#9B59B6').bold('│') +
      chalk.hex('#E74C3C').bold('               🌙 Lunar v2                      ') +
      chalk.hex('#9B59B6').bold('│')
  );
  console.log(chalk.hex('#9B59B6').bold('╰─────────────────────────────────────────────────╯'));
  console.log();
  console.log(chalk.hex('#3498DB')('📊 Status Information:'));
  console.log(
    chalk.hex('#BDC3C7')('   ├─ ') +
      chalk.hex('#ECF0F1')('Version: ') +
      chalk.hex('#E67E22').bold(`v${version}`)
  );
  console.log(
    chalk.hex('#BDC3C7')('   └─ ') +
      chalk.hex('#ECF0F1')('Updates: ') +
      chalk.hex(status.color)(`${status.icon} ${status.text}`)
  );
  if (status.extra) console.log(status.extra);
  console.log();
  console.log(chalk.hex('#2ECC71')('🌐 Deployment Methods:'));
  if (deploymentURL) {
    console.log(
      chalk.hex('#BDC3C7')('   ├─ ') +
        chalk.hex('#ECF0F1')('Deployment: ') +
        chalk.hex('#3498DB').underline(deploymentURL)
    );
    console.log(chalk.hex('#BDC3C7')('   └─ ') + chalk.hex('#95A5A6')('Environment: Cloud'));
  } else {
    console.log(
      chalk.hex('#BDC3C7')('   ├─ ') +
        chalk.hex('#ECF0F1')('Local: ') +
        chalk.hex('#1ABC9C').underline(`http://localhost:${port}`)
    );
    console.log(
      chalk.hex('#BDC3C7')('   └─ ') +
        chalk.hex('#ECF0F1')('Network: ') +
        chalk.hex('#16A085').underline(`http://127.0.0.1:${port}`)
    );
  }
  console.log();
  console.log(chalk.hex('#9B59B6')('╭─────────────────────────────────────────────────╮'));
  console.log(
    chalk.hex('#9B59B6')('│') +
      chalk.hex('#F1C40F')('    Thanks for using Lunar V2!         ') +
      chalk.hex('#9B59B6')('│')
  );
  console.log(chalk.hex('#9B59B6')('╰─────────────────────────────────────────────────╯'));
  console.log();
});
