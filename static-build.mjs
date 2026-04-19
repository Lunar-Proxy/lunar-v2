import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import http from 'http';
import { execSync } from 'child_process';
import fs from 'node:fs';

const ROUTES = ['/', '/math', '/new', '/st', '/welcome'];
const OUT_DIR = './dist/client';
const wisp = 'wss://lunaron.top/w/'; // change to wtv to change wisp server

if (!fs.existsSync('dist')) {
console.log('Building...\n');
execSync('pnpm build --static --wisp ' + wisp, { stdio: 'inherit' });
}


console.log('\nBuild complete, generating pages...\n');

const { handler } = await import('./dist/server/entry.mjs');
const server = http.createServer(handler);

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
console.log(`Server on port ${port}, generating pages...\n`);

function fetchPage(route) {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: '127.0.0.1', port, path: route }, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

for (const route of ROUTES) {
  try {
    const html = await fetchPage(route);
    if (!html || html.length < 100) {
      console.error(`✗ ${route}: empty`);
      continue;
    }
    const dir = route === '/' ? OUT_DIR : join(OUT_DIR, route);
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, 'index.html');
    writeFileSync(filePath, html, 'utf-8');
    console.log(`✓ ${route} → ${filePath} (${html.length} bytes)`);
  } catch (e) {
    console.error(`✗ ${route}: ${e.message}`);
  }
}

server.close();
console.log('\nDone! Serve dist/client/ with any static host.');
process.exit(0);
