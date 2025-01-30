import Fastify from 'fastify';
import fastifyMiddie from '@fastify/middie';
import fastifyStatic from '@fastify/static';
import fastifyCompress from '@fastify/compress';
import fs from 'node:fs';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { createServer } from 'node:http';
import { Socket } from 'node:net';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import path from 'node:path';

const PORT = 8080;
const HOST = '0.0.0.0';

async function build() {
  if (!fs.existsSync(path.resolve('dist'))) {
    console.log(chalk.yellow.bold('Lunar is not built yet, Building...'));
    try {
      execSync('npm build', { stdio: 'inherit' });
      console.log(chalk.green.bold('✅ Lunar has been built successfully!'));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Build Error: ${errorMessage}`);
    }
  } else {
    console.log(chalk.blue.bold('📂 Lunar is already built. Skipping build.'));
  }
}

const app = Fastify({
  logger: false,
  serverFactory: (handler) =>
    createServer(handler).on('upgrade', (req, socket: Socket, head) => {
      wisp.routeRequest(req, socket, head);
    }),
});

try {
  await app.register(fastifyCompress, { encodings: ['deflate', 'gzip', 'br'] });
  await build();
  // @ts-ignore - May be a error due to file not existing
  const { handler } = await import('./dist/server/entry.mjs');
  app.register(fastifyStatic, {
    root: path.resolve('dist', 'client'),
  });
  await app.register(fastifyMiddie);
  app.use(handler);
  app.listen({ host: HOST, port: PORT }, (err, address) => {
    if (err) {
      throw new Error(
        chalk.red.bold(`❌ Failed to start Lunar: ${err.message}`)
      );
    } else {
      console.log(chalk.green.bold(`\n🌙 Lunar is running at:`));
      console.log(chalk.blue.bold(`🌐 Local: http://localhost:${PORT}`));
      console.log(chalk.blue.bold(`🌍 Network: ${address}`));
    }
  });
} catch (error) {
  throw new Error(chalk.red.bold(`❌ Unexpected error: ${error}`));
}
