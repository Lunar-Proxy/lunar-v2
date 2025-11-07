import fastifyCompress from '@fastify/compress'
import fastifyMiddie from '@fastify/middie'
import fastifyStatic from '@fastify/static'
import type { FastifyStaticOptions, SetHeadersResponse } from '@fastify/static'
import { logging, server as wisp } from '@mercuryworkshop/wisp-js/server'
import chalk from 'chalk'
import Fastify from 'fastify'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import { Stats } from 'node:fs'
import { createServer } from 'node:http'
import { Socket } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { constants } from 'node:zlib'
import { updateChecker } from 'serverlib/check'
import { findProvider } from 'serverlib/provider'
import { version } from './package.json' with { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT) || 6969

logging.set_level(logging.NONE)
Object.assign(wisp.options, {
  wisp_version: 2,
  dns_method: 'resolve',
  dns_servers: ['1.1.1.3', '1.0.0.3'],
  dns_result_order: 'ipv4first',
})

async function buildCode() {
  if (!fs.existsSync('dist')) {
    console.log(chalk.hex('#f39c12')('🚀 Building Lunar...'))
    try {
      execSync('npm run build', { stdio: 'inherit' })
      console.log(chalk.hex('#2ecc71')('✅ Build completed successfully!'))
    } catch (error) {
      throw new Error(`Build failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  } else {
    console.log(chalk.hex('#3498db')('📦 Lunar is already built, skipping...'))
  }
}

const app = Fastify({
  logger: false,
  serverFactory: handler =>
    createServer(handler).on('upgrade', (req, socket: Socket, head) => {
      wisp.routeRequest(req, socket, head)
    }),
})

await buildCode()
await app.register(fastifyCompress, {
  global: true,
  encodings: ['gzip', 'deflate', 'br'],
  threshold: 1024,
  brotliOptions: {
    params: {
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      [constants.BROTLI_PARAM_QUALITY]: 4,
    },
  },
  zlibOptions: {
    level: 6,
  },
})

const staticOptions: FastifyStaticOptions = {
  maxAge: 31536000000,
  etag: true,
  lastModified: true,
  redirect: false,
  preCompressed: false,
  setHeaders(res: SetHeadersResponse, filePath: string, _stat: Stats) {
    const cacheLong = /\.(js|css|jpg|jpeg|png|gif|ico|svg|webp|avif)$/i.test(filePath)
    res.setHeader(
      'Cache-Control',
      cacheLong ? 'public, max-age=31536000, immutable' : 'public, max-age=604800',
    )
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('X-XSS-Protection', '1; mode=block')
  },
  root: path.join(__dirname, 'dist', 'client'),
}

await app.register(fastifyStatic, staticOptions)
await app.register(fastifyMiddie)

const faviconApi =
  'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64'

app.use('/api/icon', async (req: any, res: any) => {
  try {
    const urlObj = new URL(req.url ?? '', 'http://localhost')
    const targetUrl = urlObj.searchParams.get('url')
    if (!targetUrl) {
      res.statusCode = 400
      res.end('URL parameter is required.')
      return
    }
    const response = await fetch(`${faviconApi}&url=${encodeURIComponent(targetUrl)}`)
    if (!response.ok) {
      res.statusCode = response.status
      res.end('Failed to fetch favicon.')
      return
    }
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentType = response.headers.get('content-type') || 'image/png'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.end(buffer)
  } catch (err) {
    console.error('Icon error:', err)
    res.statusCode = 500
    res.end('Internal server error.')
  }
})

app.use('/api/query', async (req: any, res: any) => {
  const urlObj = new URL(req.url ?? '', 'http://localhost')
  const query = urlObj.searchParams.get('q')
  if (!query) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Query parameter "q" is required.' }))
    return
  }
  try {
    const response = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    })
    if (!response.ok) {
      res.statusCode = response.status
      res.end(JSON.stringify({ error: 'Failed to fetch suggestions.' }))
      return
    }
    const data = (await response.json()) as Array<{ phrase: string }>
    const suggestions = data.map(d => d.phrase).filter(Boolean)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ suggestions }))
  } catch (err) {
    console.error('Backend suggestion error:', err)
    res.statusCode = 500
    res.end(JSON.stringify({ error: 'Internal server error.' }))
  }
})
// @ts-ignore nope
const { handler } = await import('./dist/server/entry.mjs')
app.use(handler)

app.setNotFoundHandler((_, reply) => {
  const notFound = fs.existsSync('404') ? fs.readFileSync('404', 'utf8') : '404 Not Found'
  reply.type('text/plain').send(notFound)
})

try {
  await app.listen({ host: '0.0.0.0', port })
  const updateStatus = updateChecker()
  type StatusKey = 'u' | 'n' | 'f'
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
  }
  const status = statusMap[updateStatus.status as StatusKey] || statusMap.f
  const deploymentURL = findProvider(port)

  console.log()
  console.log(chalk.hex('#8e44ad').bold('╭────────────────────────────────────────────╮'))
  console.log(
    chalk.hex('#8e44ad').bold('│ ') +
      chalk.hex('#f39c12').bold('🌙 Lunar v2 Server Started') +
      '                │',
  )
  console.log(chalk.hex('#8e44ad').bold('╰────────────────────────────────────────────╯'))
  console.log()
  console.log(chalk.hex('#00cec9')('Information:'))
  console.log(
    chalk.hex('#bdc3c7')('   ├─ ') +
      chalk.hex('#ecf0f1')('Version: ') +
      chalk.hex('#f39c12')(`v${version}`),
  )
  console.log(
    chalk.hex('#bdc3c7')('   └─ ') +
      chalk.hex('#ecf0f1')('Up to date: ') +
      chalk.hex(status.color)(`${status.icon} ${status.text}`),
  )
  if (status.extra) console.log('       ' + status.extra)
  console.log()
  console.log(chalk.hex('#00b894')('🌐 Access Information:'))
  if (deploymentURL) {
    console.log(
      chalk.hex('#bdc3c7')('   ├─ ') +
        chalk.hex('#ecf0f1')('Deployment URL: ') +
        chalk.hex('#0984e3').underline(deploymentURL),
    )
    console.log(
      chalk.hex('#bdc3c7')('   └─ ') +
        chalk.hex('#ecf0f1')('Hosting Method: ') +
        chalk.hex('#95a5a6')('Cloud Hosting ☁️'),
    )
  } else {
    console.log(
      chalk.hex('#bdc3c7')('   ├─ ') +
        chalk.hex('#ecf0f1')('Local: ') +
        chalk.hex('#00cec9').underline(`http://localhost:${port}`),
    )
    console.log(
      chalk.hex('#bdc3c7')('   ├─ ') +
        chalk.hex('#ecf0f1')('Network: ') +
        chalk.hex('#00cec9').underline(`http://127.0.0.1:${port}`),
    )
    console.log(
      chalk.hex('#bdc3c7')('   └─ ') +
        chalk.hex('#ecf0f1')('Hosting Method: ') +
        chalk.hex('#95a5a6')('Self Hosting 💻'),
    )
  }
  console.log()
  console.log(chalk.hex('#8e44ad').bold('──────────────────────────────────────────────'))
  console.log()
} catch (err) {
  console.error(chalk.red('Failed to start server:'), err)
  process.exit(1)
}
