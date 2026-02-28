import type { APIRoute } from 'astro';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const PLAYS_FILE = join(process.cwd(), 'plays.json');
const NAME_LIMIT = 100;
const WINDOW = 60_000;
const MAX_REQS = 10;
const MAX_KEYS = 10_000;

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
    hits.set(ip, { count: 1, resetAt: now + WINDOW });
    return false;
  }
  if (entry.count >= MAX_REQS) return true;
  entry.count++;
  return false;
}

function validName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.trim().length > 0 &&
    name.length <= NAME_LIMIT &&
    /^[\w\s\-'.]+$/i.test(name)
  );
}

function readPlays(): Record<string, number> {
  if (!existsSync(PLAYS_FILE)) return {};
  try {
    const parsed = JSON.parse(readFileSync(PLAYS_FILE, 'utf-8'));
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writePlays(plays: Record<string, number>): void {
  writeFileSync(PLAYS_FILE, JSON.stringify(plays, null, 2));
}

function getIP(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = () => {
  return json(readPlays());
};

export const POST: APIRoute = async ({ request }) => {
  pruneHits();

  if (limited(getIP(request))) return json({ error: 'Too many requests' }, 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { name } = body as Record<string, unknown>;
  if (!validName(name)) return json({ error: 'Invalid name' }, 400);

  const plays = readPlays();
  if (!(name in plays) && Object.keys(plays).length >= MAX_KEYS) {
    return json({ error: 'Limit reached' }, 403);
  }

  plays[name] = (plays[name] || 0) + 1;
  writePlays(plays);

  return json({ ok: true });
};
