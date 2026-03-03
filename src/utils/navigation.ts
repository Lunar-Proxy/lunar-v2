import ConfigAPI from './config';
import { scramjetWrapper, vWrapper } from './pro';
import { TabManager } from './tb';
import { validateUrl } from './url';

const $reload = document.getElementById('refresh') as HTMLButtonElement | null;
const $back = document.getElementById('back') as HTMLButtonElement | null;
const $fwd = document.getElementById('forward') as HTMLButtonElement | null;
const $bar = document.getElementById('urlbar') as HTMLInputElement | null;
const $fav = document.getElementById('fav') as HTMLButtonElement | null;
const $home = document.getElementById('home') as HTMLElement | null;
const $side = document.querySelector('aside');

const routes: Record<string, string> = {
  'lunar://settings': '/st',
  'lunar://new': '/new',
  'lunar://games': '/math',
};

const byPath = Object.fromEntries(Object.entries(routes).map(([k, v]) => [v, k]));

let wisp: string;

function frame(): HTMLIFrameElement | null {
  const id = TabManager.activeTabId;
  if (!id) return null;
  return document.getElementById(`frame-${id}`) as HTMLIFrameElement | null;
}

function spin(): void {
  if (!$reload) return;
  $reload.style.animation = 'none';
  $reload.offsetWidth;
  $reload.style.animation = 'spin 0.4s linear';
}

function go(url: string): void {
  const f = frame();
  if (f) f.src = url;
}

function stripPrefix(url: string): string {
  try {
    const { prefix: sp } = scramjetWrapper.getConfig();
    const { prefix: up } = vWrapper.getConfig();
    const path = new URL(url, location.origin).pathname;
    if (path.startsWith(sp)) return path.slice(sp.length);
    if (path.startsWith(up)) return path.slice(up.length);
    return path;
  } catch {
    return url;
  }
}

async function decodeUrl(enc: string): Promise<string> {
  const backend = await ConfigAPI.get('backend');
  const uv = vWrapper.getConfig();
  if (backend === 'u' && typeof uv.decodeUrl === 'function') return uv.decodeUrl(enc);
  return scramjetWrapper.getConfig().codec.decode(enc);
}

function norm(url: string): string {
  try {
    return decodeURIComponent(url).replace(/\/$/, '');
  } catch {
    return url.replace(/\/$/, '');
  }
}

async function syncFav(): Promise<void> {
  const f = frame();
  if (!f) return;
  const decoded = await decodeUrl(stripPrefix(f.src));
  const bms: any[] = (await ConfigAPI.get('bm')) || [];
  const saved = bms.some(b => norm(b.redir) === norm(decoded));
  const svg = $fav?.querySelector('svg');
  if (svg) {
    svg.style.fill = saved ? '#a8a3c7' : 'none';
    svg.style.stroke = saved ? '#a8a3c7' : '';
  }
}

async function toggleFav(): Promise<void> {
  const f = frame();
  if (!f || !$bar) return;
  const decoded = await decodeUrl(stripPrefix(f.src));
  const bms: any[] = (await ConfigAPI.get('bm')) || [];
  const idx = bms.findIndex(b => norm(b.redir) === norm(decoded));
  if (idx !== -1) {
    bms.splice(idx, 1);
  } else {
    let host = decoded;
    try {
      host = new URL(decoded).hostname;
    } catch {}
    bms.push({
      name: f.contentDocument?.title || decoded,
      logo: `/api/icon/?url=https://${host}`,
      redir: decoded,
    });
  }
  await ConfigAPI.set('bm', bms);
  syncFav();
}

async function submit(): Promise<void> {
  if (!$bar) return;
  const input = $bar.value.trim();

  if (routes[input]) {
    spin();
    go(routes[input]);
    return;
  }

  const conn = new BareMux.BareMuxConnection('/bm/worker.js');
  if ((await conn.getTransport()) !== '/lc/index.mjs') {
    await conn.setTransport('/lc/index.mjs', [{ wisp }]);
  }

  const url = await validateUrl(input);
  const backend = await ConfigAPI.get('backend');
  const sj = scramjetWrapper.getConfig();
  const uv = vWrapper.getConfig();

  const dest =
    backend === 'u' ? `${uv.prefix}${uv.encodeUrl(url)}` : `${sj.prefix}${sj.codec.encode(url)}`;

  spin();
  go(dest);
}

function onSidebarClick(e: MouseEvent): void {
  const btn = (e.target as HTMLElement).closest('button');
  if (!btn || !$bar) return;
  e.preventDefault();
  e.stopPropagation();
  const dataUrl = btn.dataset.url;
  if (!dataUrl) return;
  const display = (dataUrl === '/' ? 'lunar://new' : byPath[dataUrl]) ?? dataUrl;
  $bar.value = display;
  spin();
  go(routes[display] ?? dataUrl);
}

async function setup(): Promise<void> {
  wisp = await ConfigAPI.get('wispUrl');
  await scramjetWrapper.init();
  await navigator.serviceWorker.register('./sw.js');
  const conn = new BareMux.BareMuxConnection('/bm/worker.js');
  if ((await conn.getTransport()) !== '/lc/index.mjs') {
    await conn.setTransport('/lc/index.mjs', [{ wisp }]);
  }
}

$reload?.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  frame()?.contentWindow?.location.reload();
});

$back?.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  spin();
  frame()?.contentWindow?.history.back();
});

$fwd?.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  spin();
  frame()?.contentWindow?.history.forward();
});

$home?.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  spin();
  go('/new');
});

$fav?.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  toggleFav();
});

$bar?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submit();
  }
});

$side?.addEventListener('click', onSidebarClick);
TabManager.onUrlChange(syncFav);
setup();
