import Fastify from 'fastify';
import fastifyMiddie from '@fastify/middie';
import fastifyStatic from '@fastify/static';
import fastifyCompress from '@fastify/compress';
import basicAuth from '@fastify/basic-auth';
import fs from 'node:fs';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { createServer } from 'node:http';
import { Socket } from 'node:net';
import path from 'node:path';
import { version } from './package.json';
import config from './config';
import { server as wisp, logging } from '@mercuryworkshop/wisp-js/server';

const port: number = config.port;
const host: string = '0.0.0.0';

logging.set_level('logging.', config.logType);

wisp.options.wisp_version = 2;

function getCommitDate(): string {
  try {
    return execSync('git log -1 --format=%cd', { stdio: 'pipe' }).toString().trim();
  } catch {
    return new Date().toISOString();
  }
}

async function build() {
  if (!fs.existsSync('dist')) {
    console.log(chalk.yellow.bold('🚀 Building Lunar...'));
    try {
      execSync('pnpm build', { stdio: 'inherit' });
      console.log(chalk.green.bold('✅ Succesfully built Lunar V2!'));
    } catch (error) {
      throw new Error(
        `A error encurred while building: ${error instanceof Error ? error.message : String(error)}`,
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

await app.register(fastifyCompress, { encodings: ['deflate', 'gzip', 'br'] });

if (config.auth.protect) {
  console.log(chalk.magenta.bold('🔒 Password Protection Enabled.'));
  config.auth.users.forEach((user: { [key: string]: string }) => {
    Object.entries(user).forEach(([username, password]) => {
      console.log(chalk.yellow('🔑 Users:'));
      console.log(chalk.cyan(`➡ Username: ${username}, Password: ${password}`));
    });
  });

  await app.register(basicAuth, {
    authenticate: true,
    validate(username, password, _req, _reply, done) {
      const user = config.auth.users.find((user: { [key: string]: string }) => user[username]);
      if (user && user[username] === password) {
        if (config.auth.log) {
          console.log(chalk.green(`✅ Authenticated: ${username}`));
        }
        return done();
      }
      return done(new Error('Invalid credentials'));
    },
  });
  app.addHook('onRequest', app.basicAuth);
}

app.setErrorHandler((error, _request, reply) => {
  if (error.statusCode === 401) {
    reply.status(401).header('Content-Type', 'text/html').send(`
         <!doctype html>
<html>
  <head>
    <title>Welcome to nginx!</title>
    <style>
      html {
        color-scheme: light dark;
      }
      body {
        width: 35em;
        margin: 0 auto;
        font-family: Tahoma, Verdana, Arial, sans-serif;
      }
    </style>
  </head>
  <body>
    <h1>Welcome to nginx!</h1>
    <p>
      If you see this page, the nginx web server is successfully installed and
      working. Further configuration is required. If you are expecting another
      page, please check your network or
      <a id="rcheck" onclick="location.reload();"><b>Refresh this page</b></a>
    </p>

    <p>
      For online documentation and support please refer to
      <a href="http://nginx.org/">nginx.org</a>.<br />
      Commercial support is available at
      <a href="http://nginx.com/">nginx.com</a>.
    </p>

    <p><em>Thank you for using nginx.</em></p>
  </body>
</html>
      `);
  } else {
    reply.send(error);
  }
});

await build();

const commitDate = getCommitDate();
const staticOptions = {
  maxAge: 86400, // 1d
  etag: true,
  lastModified: true,
  setHeaders: (res: any, filePath: string) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0');
    } else if (/\.(js|css|jpg|jpeg|png|gif|ico|svg|webp|avif)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    }
  },
};

// @ts-ignore dir may not exist
const { handler } = await import('./dist/server/entry.mjs');

app.register(fastifyStatic, {
  root: path.join(import.meta.dirname, 'dist', 'client'),
  ...staticOptions,
});

await app.register(fastifyMiddie);
app.use(handler);

app.listen({ host, port }, (err) => {
  if (err) {
    throw new Error(`❌ Failed to start Lunar V2: ${err.message}`);
  }
  console.log(chalk.green.bold(`\n Lunar V2`));

  console.log(
    chalk.whiteBright(
      `📅 Last Updated: ${chalk.cyanBright(new Date(commitDate).toLocaleString())}`,
    ),
  );
  console.log(chalk.whiteBright(`🛠  Version: ${chalk.cyanBright(version)}`));

  // credits to night proxy for the idea :D
  let deploymentURL: string | null = null;

  if (process.env.RENDER) {
    deploymentURL = `${process.env.RENDER_EXTERNAL_URL}`;
  } else if (process.env.VERCEL) {
    deploymentURL = `https://${process.env.VERCEL_URL}`;
  } else if (process.env.RAILWAY_STATIC_URL) {
    deploymentURL = `https://${process.env.RAILWAY_STATIC_URL}`;
  } else if (process.env.FLY_APP_NAME) {
    deploymentURL = `https://${process.env.FLY_APP_NAME}.fly.dev`;
  } else if (process.env.CODESPACES) {
    deploymentURL = `https://${process.env.CODESPACE_NAME}-${port}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`;
  } else if (process.env.GITPOD_WORKSPACE_URL) {
    deploymentURL = process.env.GITPOD_WORKSPACE_URL.replace('https://', `https://${port}-`);
  } else if (process.env.REPL_ID) {
    deploymentURL = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  } else if (process.env.KOYEB_APP_NAME) {
    deploymentURL = `https://${process.env.KOYEB_APP_NAME}.koyeb.app`;
  }

  if (deploymentURL) {
    console.log(chalk.blueBright(`   ➡ Hosted:   ${chalk.underline(deploymentURL)}`));
  } else {
    console.log(chalk.blueBright(`   ➡ Local:    ${chalk.underline(`http://localhost:${port}`)}`));
    console.log(chalk.blueBright(`   ➡ Network:  http://127.0.0.1:${port}`));
  }
});
