import ConfigAPI from './config';
import { scramjetWrapper, vWrapper } from './pro';
import { TabManager } from './tb';
import { validateUrl } from './url';

const reload = document.getElementById('refresh') as HTMLButtonElement | null;
const back = document.getElementById('back') as HTMLButtonElement | null;
const forward = document.getElementById('forward') as HTMLButtonElement | null;
const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
const favorite = document.getElementById('fav') as HTMLButtonElement | null;
const home = document.getElementById('home') as HTMLElement | null;
const wispUrl = await ConfigAPI.get('wispUrl');
const nativePaths: Record<string, string> = {
  'lunar://settings': '/st',
  'lunar://new': '/new',
  'lunar://games': '/math',
  'lunar://apps': '/sci',
};

const scramjetInstance = scramjetWrapper.getConfig();
const vInstance = vWrapper.getConfig();

scramjetWrapper.init();
await navigator.serviceWorker.register('./sw.js');

const connection = new BareMux.BareMuxConnection(`/bm/worker.js`);
if ((await connection.getTransport()) !== `/lc/index.mjs`)
  await connection.setTransport(`/lc/index.mjs`, [{ wisp: wispUrl }]);

type TabHistory = { stack: string[]; index: number };
const histories = new Map<string, TabHistory>();

function getActiveFrame(): HTMLIFrameElement | null {
  return document.getElementById(`frame-${TabManager.activeTabId}`) as HTMLIFrameElement | null;
}

function getHistory(): TabHistory {
  const id = String(TabManager.activeTabId);
  if (!histories.has(id)) histories.set(id, { stack: [], index: -1 });
  return histories.get(id)!;
}

function loading() {
  if (!reload) return;
  reload.style.animation = 'none';
  void reload.offsetWidth;
  reload.style.animation = 'spin 0.4s linear';
}

function record(url: string) {
  const history = getHistory();
  if (history.stack[history.index] === url) return;
  history.stack.length = history.index + 1;
  history.stack.push(url);
  history.index++;
}

function navigate(url: string, push = true) {
  const frame = getActiveFrame();
  if (!frame) return;
  if (push) record(url);
  frame.src = url;
}

function backNavigate() {
  const history = getHistory();
  if (history.index <= 0) return;
  history.index--;
  navigate(history.stack[history.index], false);
}

function forwardNavigate() {
  const history = getHistory();
  if (history.index >= history.stack.length - 1) return;
  history.index++;
  navigate(history.stack[history.index], false);
}

async function updateBookmark() {
  const frame = getActiveFrame();
  if (!frame) return;
  record(frame.src);
  let src = frame.src;
  try {
    const u = new URL(src, location.origin);
    let p = u.pathname + u.search;
    if (p.startsWith(scramjetInstance.prefix)) p = p.slice(scramjetInstance.prefix.length);
    else if (p.startsWith(vInstance.prefix)) p = p.slice(vInstance.prefix.length);
    src = p;
  } catch {}
  const backend = await ConfigAPI.get('backend');
  const url =
    backend === 'u' && typeof vInstance.decodeUrl === 'function'
      ? vInstance.decodeUrl(src)
      : scramjetInstance.codec.decode(src);
  const currentBm = (await ConfigAPI.get('bm')) || [];
  const normalize = (u: string) => {
    try {
      return decodeURIComponent(u).replace(/\/$/, '');
    } catch {
      return u.replace(/\/$/, '');
    }
  };
  const active = currentBm.some((b: any) => normalize(b.redir) === normalize(url));
  const svg = favorite?.querySelector('svg');
  if (svg) {
    svg.style.fill = active ? '#a8a3c7' : 'none';
    svg.style.stroke = active ? '#a8a3c7' : '';
  }
}

reload?.addEventListener('click', () => {
  const history = getHistory();
  if (history.index >= 0) navigate(history.stack[history.index], false);
});

back?.addEventListener('click', () => {
  loading();
  backNavigate();
});

forward?.addEventListener('click', () => {
  loading();
  forwardNavigate();
});

home?.addEventListener('click', () => {
  loading();
  navigate('/new');
});

favorite?.addEventListener('click', async () => {
  if (!urlbar) return;
  const frame = getActiveFrame();
  if (!frame || nativePaths[urlbar.value]) return;
  let src = frame.src;
  try {
    const url = new URL(src, location.origin);
    let path = url.pathname + url.search;
    if (path.startsWith(scramjetInstance.prefix)) path = path.slice(scramjetInstance.prefix.length);
    else if (path.startsWith(vInstance.prefix)) path = path.slice(vInstance.prefix.length);
    src = path;
  } catch {}
  const backend = await ConfigAPI.get('backend');
  const url =
    backend === 'u' && typeof vInstance.decodeUrl === 'function'
      ? vInstance.decodeUrl(src)
      : scramjetInstance.codec.decode(src);
  const currentBm = (await ConfigAPI.get('bm')) || [];
  const normalize = (u: string) => {
    try {
      return decodeURIComponent(u).replace(/\/$/, '');
    } catch {
      return u.replace(/\/$/, '');
    }
  };
  const index = currentBm.findIndex((b: any) => normalize(b.redir) === normalize(url));
  if (index !== -1) currentBm.splice(index, 1);
  else {
    let domain = url;
    try {
      domain = new URL(url).hostname;
    } catch {}
    currentBm.push({
      name: frame.contentDocument?.title || url,
      logo: `/api/icon/?url=https://${domain}`,
      redir: url,
    });
  }
  await ConfigAPI.set('bm', currentBm);
  updateBookmark();
});

urlbar?.addEventListener('keydown', async e => {
  if (e.key !== 'Enter') return;
  const value = urlbar.value.trim();
  if (nativePaths[value]) {
    loading();
    navigate(nativePaths[value]);
    return;
  }
  if ((await connection.getTransport()) !== `/lc/index.mjs`)
    await connection.setTransport(`/lc/index.mjs`, [{ wisp: wispUrl }]);
  const input = await validateUrl(value);
  const backend = await ConfigAPI.get('backend');
  const url =
    backend === 'u'
      ? `${vInstance.prefix}${vInstance.encodeUrl(input)}`
      : `${scramjetInstance.prefix}${scramjetInstance.codec.encode(input)}`;
  loading();
  navigate(url);
});

document.querySelectorAll<HTMLElement>('aside button').forEach(el => {
  el.addEventListener('click', ev => {
    ev.preventDefault();
    const targetUrl = el.getAttribute('data-url');
    if (!targetUrl) return;
    let nativeKey = Object.keys(nativePaths).find(k => nativePaths[k] === targetUrl);
    if (!nativeKey && targetUrl === '/') nativeKey = 'lunar://new';
    if (nativeKey && urlbar) urlbar.value = nativeKey;
    loading();
    navigate(nativeKey ? nativePaths[nativeKey] : targetUrl);
  });
});

TabManager.onUrlChange(updateBookmark);
