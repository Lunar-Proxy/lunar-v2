import ConfigAPI from './config';
import { scramjetWrapper, vWrapper } from './pro';
import { TabManager } from './tb';
import { validateUrl } from './url';

const reloadBtn = document.getElementById('refresh') as HTMLButtonElement | null;
const backBtn = document.getElementById('back') as HTMLButtonElement | null;
const fwdBtn = document.getElementById('forward') as HTMLButtonElement | null;
const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
const favBtn = document.getElementById('fav') as HTMLButtonElement | null;
const homeBtn = document.getElementById('home') as HTMLElement | null;
const sidebar = document.querySelector('aside');

const routes: Record<string, string> = {
  'lunar://settings': '/st',
  'lunar://new': '/new',
  'lunar://games': '/math',
  'lunar://apps': '/sci',
};

const reverseRoutes = Object.fromEntries(
  Object.entries(routes).map(([k, v]) => [v, k])
);

const sc = scramjetWrapper.getConfig();
const uv = vWrapper.getConfig();
const hist = new Map<string, { stack: string[]; idx: number }>();

let wisp: string;

async function setup() {
  wisp = await ConfigAPI.get('wispUrl');
  scramjetWrapper.init();
  await navigator.serviceWorker.register('./sw.js');
  
  const conn = new BareMux.BareMuxConnection('/bm/worker.js');
  const trans = await conn.getTransport();
  if (trans !== '/lc/index.mjs') {
    await conn.setTransport('/lc/index.mjs', [{ wisp }]);
  }
}

function frame(): HTMLIFrameElement | null {
  const id = TabManager.activeTabId;
  if (!id) return null;
  return document.getElementById(`frame-${id}`) as HTMLIFrameElement | null;
}

function history() {
  const id = String(TabManager.activeTabId);
  if (!hist.has(id)) {
    hist.set(id, { stack: [], idx: -1 });
  }
  return hist.get(id)!;
}

function spin() {
  if (!reloadBtn) return;
  reloadBtn.style.animation = 'none';
  reloadBtn.offsetWidth;
  reloadBtn.style.animation = 'spin 0.4s linear';
}

function record(url: string) {
  const h = history();
  if (h.stack[h.idx] === url) return;
  
  h.stack = h.stack.slice(0, h.idx + 1);
  h.stack.push(url);
  h.idx++;
}

function nav(url: string, save = true) {
  const f = frame();
  if (!f) return;
  
  if (save) record(url);
  f.src = url;
}

function back() {
  const h = history();
  if (h.idx <= 0) return;
  
  h.idx--;
  nav(h.stack[h.idx], false);
}

function fwd() {
  const h = history();
  if (h.idx >= h.stack.length - 1) return;
  
  h.idx++;
  nav(h.stack[h.idx], false);
}

function strip(url: string): string {
  try {
    const u = new URL(url, location.origin);
    let p = u.pathname + u.search;
    
    if (p.startsWith(sc.prefix)) {
      return p.slice(sc.prefix.length);
    }
    if (p.startsWith(uv.prefix)) {
      return p.slice(uv.prefix.length);
    }
    
    return p;
  } catch {
    return url;
  }
}

async function decode(enc: string): Promise<string> {
  const backend = await ConfigAPI.get('backend');
  
  if (backend === 'u' && typeof uv.decodeUrl === 'function') {
    return uv.decodeUrl(enc);
  }
  
  return sc.codec.decode(enc);
}

function norm(url: string): string {
  try {
    return decodeURIComponent(url).replace(/\/$/, '');
  } catch {
    return url.replace(/\/$/, '');
  }
}

async function sync() {
  const f = frame();
  if (!f) return;
  
  record(f.src);
  
  const s = strip(f.src);
  const d = await decode(s);
  const bm = (await ConfigAPI.get('bm')) || [];
  const active = bm.some((b: any) => norm(b.redir) === norm(d));
  
  const svg = favBtn?.querySelector('svg');
  if (svg) {
    svg.style.fill = active ? '#a8a3c7' : 'none';
    svg.style.stroke = active ? '#a8a3c7' : '';
  }
}

async function toggleFav() {
  if (!urlbar) return;
  
  const f = frame();
  if (!f || routes[urlbar.value]) return;
  
  const s = strip(f.src);
  const d = await decode(s);
  const bm = (await ConfigAPI.get('bm')) || [];
  
  const i = bm.findIndex((b: any) => norm(b.redir) === norm(d));
  
  if (i !== -1) {
    bm.splice(i, 1);
  } else {
    let domain = d;
    try {
      domain = new URL(d).hostname;
    } catch {}
    
    bm.push({
      name: f.contentDocument?.title || d,
      logo: `/api/icon/?url=https://${domain}`,
      redir: d,
    });
  }
  
  await ConfigAPI.set('bm', bm);
  sync();
}

async function submit() {
  if (!urlbar) return;
  
  const v = urlbar.value.trim();
  
  if (routes[v]) {
    spin();
    nav(routes[v]);
    return;
  }
  
  const conn = new BareMux.BareMuxConnection('/bm/worker.js');
  const trans = await conn.getTransport();
  if (trans !== '/lc/index.mjs') {
    await conn.setTransport('/lc/index.mjs', [{ wisp }]);
  }
  
  const val = await validateUrl(v);
  const backend = await ConfigAPI.get('backend');
  
  const enc = backend === 'u'
    ? `${uv.prefix}${uv.encodeUrl(val)}`
    : `${sc.prefix}${sc.codec.encode(val)}`;
  
  spin();
  nav(enc);
}

function clickSide(e: MouseEvent) {
  const btn = (e.target as HTMLElement).closest('button');
  if (!btn) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  const url = btn.dataset.url;
  if (!url || !urlbar) return;
  
  let r = reverseRoutes[url];
  if (!r && url === '/') {
    r = 'lunar://new';
  }
  
  urlbar.value = r || url;
  const target = r ? routes[r] : url;
  
  spin();
  nav(target);
}

if (reloadBtn) {
  reloadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const h = history();
    if (h.idx >= 0) {
      nav(h.stack[h.idx], false);
    }
  });
}

if (backBtn) {
  backBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    spin();
    back();
  });
}

if (fwdBtn) {
  fwdBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    spin();
    fwd();
  });
}

if (homeBtn) {
  homeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    spin();
    nav('/new');
  });
}

if (favBtn) {
  favBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFav();
  });
}

if (urlbar) {
  urlbar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
}

if (sidebar) {
  sidebar.addEventListener('click', clickSide);
}

TabManager.onUrlChange(sync);

setup();