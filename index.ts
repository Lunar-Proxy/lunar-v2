import Fastify from 'fastify';
import fastifyMiddie from '@fastify/middie';
import fastifyStatic from '@fastify/static';
import fastifyCompress from '@fastify/compress';
import fs from 'node:fs';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { createServer } from 'node:http';
import { Socket } from 'node:net';
import path from 'node:path';
import { version } from './package.json';
import { server as wisp, logging } from '@mercuryworkshop/wisp-js/server';
import fetch from 'node-fetch';
import { updateChecker } from 'serverlib/check';
import { error } from 'node:console';

const port: number = parseInt(process.env.PORT as string) || parseInt('8080');

logging.set_level(`logging.INFO`);
wisp.options.wisp_version = 2;
wisp.options.dns_method = 'resolve';
wisp.options.dns_servers = ['94.140.14.14', '94.140.15.15', '1.1.1.3', '1.0.0.3'];
wisp.options.dns_result_order = 'ipv4first';

async function build() {
  if (!fs.existsSync('dist')) {
    console.log(chalk.yellow.bold('🚀 Building Lunar...'));
    try {
      execSync('npm run build', { stdio: 'inherit' });
      console.log(chalk.green.bold('✅ Successfully built Lunar V2!'));
    } catch (error) {
      throw new Error(
        `An error occurred while building: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    console.log(chalk.blue.bold('📂 Lunar is already built! Skipping the build process...'));
  }
}

const app = Fastify({
  logger: false,
  serverFactory: (handler) =>
    createServer(handler).on('upgrade', (req, socket: Socket, head) => {
      wisp.routeRequest(req, socket, head);
    }),
});

await app.register(fastifyCompress, {
  global: true,
  encodings: ['gzip', 'deflate', 'br'],
});

await build();

const staticOptions = {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  redirect: false,
  setHeaders(res: any, filePath: string) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0');
    } else if (/\.(js|css|jpg|jpeg|png|gif|ico|svg|webp|avif)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
  },
};

app.get('/api/icon/', async (req, reply) => {
  try {
    const url = (req.query as { url?: string }).url;
    if (!url) {
      return reply.status(400).send('URL parameter is required.');
    }

    const response = await fetch(
      `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${url}&size=64`,
    );

    if (!response.ok) {
      return reply.status(500).send('Failed to fetch the favicon.');
    }

    const data = await response.arrayBuffer();
    const buffer = Buffer.from(data);

    reply.type('image/jpeg').send(buffer);
  } catch (error) {
    console.error(error);
    reply.status(500).send('Internal server error.');
  }
});

await app.register(fastifyStatic, {
  root: path.join(import.meta.dirname, 'dist', 'client'),
  ...staticOptions,
});

// @ts-ignore
const { handler } = await import('./dist/server/entry.mjs');
await app.register(fastifyMiddie);
app.use(handler);

// @ts-ignore later astro
app.setNotFoundHandler((request, reply) => {
  reply.type('text/plain').send(fs.readFileSync('/404'));
});

app.listen({ port: port, host: '0.0.0.0' }).then(async () => {
  const updateStatus = updateChecker();
  const statusMsg =
    updateStatus.status === 'u'
      ? '✅'
      : updateStatus.status === 'n'
        ? `❌, Please update to ${updateStatus.commitId}:\n  https://github.com/lunar-proxy/lunar-v1/wiki`
        : '❌ Error checking for updates';

  console.log(chalk.green.bold(`🚀 Lunar is running\n`));
  console.log(chalk.gray('───────────────────────────────────────────────'));
  console.log(chalk.whiteBright(`Up to date:`), chalk.cyanBright(statusMsg));
  console.log(chalk.whiteBright(`🛠  Version:`), chalk.cyanBright(version));
  console.log(chalk.gray('───────────────────────────────────────────────'));

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

  if (deploymentURL) {
    console.log(chalk.blueBright(`\n🌐 Deployment URL:`));
    console.log(chalk.underline(chalk.green(deploymentURL)));
  } else {
    console.log(chalk.blueBright(`\n💻 Local:`));
    console.log(chalk.underline(chalk.yellow(`http://localhost:${port}`)));
    console.log(chalk.blueBright(`\n🌐 Network:`));
    console.log(chalk.underline(chalk.cyan(`http://127.0.0.1:${port}`)));
  }

  console.log(chalk.gray('───────────────────────────────────────────────'));
  console.log(chalk.magentaBright.bold(`\n✨ Thanks for using Lunar V2 :)\n`));
});
