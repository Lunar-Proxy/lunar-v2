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
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import path from 'node:path';

const port: number = 8080;
const host: string = '0.0.0.0';

async function build() {
  if (!fs.existsSync('dist')) {
    console.log(chalk.yellow.bold('Lunar is not built, building now...'));
    try {
      execSync('pnpm build', { stdio: 'inherit' });
      console.log(chalk.green.bold('✅ Lunar was built successfully!'));
    } catch (error) {
      throw new Error(
        `Build Error: ${error instanceof Error ? error.message : String(error)}`
      );
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

await app.register(fastifyCompress, { encodings: ['deflate', 'gzip', 'br'] });
await build();

// @ts-ignore dir may not exist
const { handler } = await import('./dist/server/entry.mjs');
app.register(fastifyStatic, {
  root: path.join(import.meta.dirname, 'dist', 'client'),
});
await app.register(fastifyMiddie);
app.use(handler);

app.listen({ host, port }, (err, address) => {
  if (err) {
    throw new Error(`❌ Failed to start Lunar: ${err.message}`);
  } else {
    console.log(chalk.green.bold(`\n🌙 Lunar is running at:`));
    console.log(chalk.blue.bold(`🌐 Local: http://localhost:${port}`));
    console.log(chalk.blue.bold(`🌍 Network: ${address}`));
  }
});
