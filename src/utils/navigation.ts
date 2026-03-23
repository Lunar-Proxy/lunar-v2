import ConfigAPI from './config';
import { scramjetWrapper, vWrapper } from './pro';
import { TabManager } from './tb';
import { validateUrl } from './url';
import { shadow, ready } from './shadow';

const routes: Record<string, string> = {
  'lunar://settings': '/st',
  'lunar://new': '/new',
  'lunar://games': '/math',
};

const byPath = Object.fromEntries(Object.entries(routes).map(([k, v]) => [v, k]));

let wisp: string;
let reloadBtn: HTMLButtonElement | null = null;
let backBtn: HTMLButtonElement | null = null;
let forwardBtn: HTMLButtonElement | null = null;
let urlBar: HTMLInputElement | null = null;
let favBtn: HTMLButtonElement | null = null;
let homeBtn: HTMLElement | null = null;
let sidebar: Element | null = null;

function frame(): HTMLIFrameElement | null {
  const id = TabManager.activeTabId;
  if (!id) return null;
  return shadow.querySelector(`#frame-${id}`) as HTMLIFrameElement | null;
}

function spin(): void {
  if (!reloadBtn) return;
  reloadBtn.style.animation = 'none';
  reloadBtn.offsetWidth;
  reloadBtn.style.animation = 'spin 0.4s linear';
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
  const svg = favBtn?.querySelector('svg');
  if (svg) {
    svg.style.fill = saved ? '#a8a3c7' : 'none';
    svg.style.stroke = saved ? '#a8a3c7' : '';
  }
}

async function toggleFav(): Promise<void> {
  const f = frame();
  if (!f || !urlBar) return;
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
  if (!urlBar) return;
  const input = urlBar.value.trim();
  urlBar.blur();
  if (routes[input]) {
    spin();
    go(routes[input]);
    return;
  }

  const conn = new BareMux.BareMuxConnection('/bm/worker.js');
  const transport = await ConfigAPI.get('transport');
  if (transport === 'ep' && (await conn.getTransport()) !== '/ep/index.mjs') {
    await conn.setTransport('/ep/index.mjs', [{ wisp }]);
  } else if (transport === 'lc' && (await conn.getTransport()) !== '/lc/index.mjs') {
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
  if (!btn || !urlBar) return;
  e.preventDefault();
  e.stopPropagation();
  const dataUrl = btn.dataset.url;
  if (!dataUrl) return;
  const display = (dataUrl === '/' ? 'lunar://new' : byPath[dataUrl]) ?? dataUrl;
  urlBar.value = display;
  spin();
  go(routes[display] ?? dataUrl);
}

async function setup(): Promise<void> {
  const [wispUrl] = await Promise.all([
    ConfigAPI.get('wispUrl'),
    scramjetWrapper.init(),
    navigator.serviceWorker.register('./sw.js'),
  ]);
  wisp = wispUrl;
  const conn = new BareMux.BareMuxConnection('/bm/worker.js');
  if ((await conn.getTransport()) !== '/lc/index.mjs') {
    await conn.setTransport('/lc/index.mjs', [{ wisp }]);
  }
}

ready.then(() => {
  reloadBtn = shadow.querySelector('#refresh') as HTMLButtonElement | null;
  backBtn = shadow.querySelector('#back') as HTMLButtonElement | null;
  forwardBtn = shadow.querySelector('#forward') as HTMLButtonElement | null;
  urlBar = shadow.querySelector('#urlbar') as HTMLInputElement | null;
  favBtn = shadow.querySelector('#fav') as HTMLButtonElement | null;
  homeBtn = shadow.querySelector('#home') as HTMLElement | null;
  sidebar = shadow.querySelector('aside');

  reloadBtn?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    frame()?.contentWindow?.location.reload();
  });

  backBtn?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    spin();
    frame()?.contentWindow?.history.back();
  });

  forwardBtn?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    spin();
    frame()?.contentWindow?.history.forward();
  });

  homeBtn?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    spin();
    go('/new');
  });

  favBtn?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    toggleFav();
  });

  urlBar?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });

  sidebar?.addEventListener('click', onSidebarClick as EventListener);
  TabManager.onUrlChange(syncFav);
  setup();
});
