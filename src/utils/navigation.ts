import ConfigAPI from './config';
import { scramjetWrapper, vWrapper } from './pro';
import { TabManager } from './tb';
import { validateUrl } from './url';

const reloadBtn = document.getElementById('refresh') as HTMLButtonElement | null;
const backBtn = document.getElementById('back') as HTMLButtonElement | null;
const forwardBtn = document.getElementById('forward') as HTMLButtonElement | null;
const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
const favBtn = document.getElementById('fav') as HTMLButtonElement | null;
const homeBtn = document.getElementById('home') as HTMLElement | null;
const sidebar = document.querySelector('aside');

const internalRoutes: Record<string, string> = {
  'lunar://settings': '/st',
  'lunar://new': '/new',
  'lunar://games': '/math',
};

const routesByPath = Object.fromEntries(
  Object.entries(internalRoutes).map(([key, path]) => [path, key]),
);

const scramjetConfig = scramjetWrapper.getConfig();
const uvConfig = vWrapper.getConfig();

const tabHistories = new Map<string, { stack: string[]; index: number }>();

let wispUrl: string;

async function setup(): Promise<void> {
  wispUrl = await ConfigAPI.get('wispUrl');
  scramjetWrapper.init();
  await navigator.serviceWorker.register('./sw.js');

  const conn = new BareMux.BareMuxConnection('/bm/worker.js');
  const transport = await conn.getTransport();
  if (transport !== '/lc/index.mjs') {
    await conn.setTransport('/lc/index.mjs', [{ wisp: wispUrl }]);
  }
}

function getActiveFrame(): HTMLIFrameElement | null {
  const tabId = TabManager.activeTabId;
  if (!tabId) return null;
  return document.getElementById(`frame-${tabId}`) as HTMLIFrameElement | null;
}

function getTabHistory() {
  const tabId = String(TabManager.activeTabId);
  if (!tabHistories.has(tabId)) {
    tabHistories.set(tabId, { stack: [], index: -1 });
  }
  return tabHistories.get(tabId)!;
}

function spinReloadIcon(): void {
  if (!reloadBtn) return;
  reloadBtn.style.animation = 'none';
  reloadBtn.offsetWidth; // force reflow
  reloadBtn.style.animation = 'spin 0.4s linear';
}

function pushHistory(url: string): void {
  const history = getTabHistory();
  if (history.stack[history.index] === url) return;
  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(url);
  history.index++;
}

function navigateTo(url: string, recordHistory = true): void {
  const activeFrame = getActiveFrame();
  if (!activeFrame) return;
  if (recordHistory) pushHistory(url);
  activeFrame.src = url;
}

function goBack(): void {
  const history = getTabHistory();
  if (history.index <= 0) return;
  history.index--;
  navigateTo(history.stack[history.index], false);
}

function goForward(): void {
  const history = getTabHistory();
  if (history.index >= history.stack.length - 1) return;
  history.index++;
  navigateTo(history.stack[history.index], false);
}

function stripProxyPrefix(url: string): string {
  try {
    const parsed = new URL(url, location.origin);
    const path = parsed.pathname + parsed.search;
    if (path.startsWith(scramjetConfig.prefix)) return path.slice(scramjetConfig.prefix.length);
    if (path.startsWith(uvConfig.prefix)) return path.slice(uvConfig.prefix.length);
    return path;
  } catch {
    return url;
  }
}

async function decodeProxyUrl(encoded: string): Promise<string> {
  const backend = await ConfigAPI.get('backend');
  if (backend === 'u' && typeof uvConfig.decodeUrl === 'function') {
    return uvConfig.decodeUrl(encoded);
  }
  return scramjetConfig.codec.decode(encoded);
}

function normalizeUrl(url: string): string {
  try {
    return decodeURIComponent(url).replace(/\/$/, '');
  } catch {
    return url.replace(/\/$/, '');
  }
}

async function syncFavButton(): Promise<void> {
  const activeFrame = getActiveFrame();
  if (!activeFrame) return;

  pushHistory(activeFrame.src);

  const stripped = stripProxyPrefix(activeFrame.src);
  const decoded = await decodeProxyUrl(stripped);
  const bookmarks = (await ConfigAPI.get('bm')) || [];
  const isBookmarked = bookmarks.some(
    (bookmark: any) => normalizeUrl(bookmark.redir) === normalizeUrl(decoded),
  );

  const svg = favBtn?.querySelector('svg');
  if (svg) {
    svg.style.fill = isBookmarked ? '#a8a3c7' : 'none';
    svg.style.stroke = isBookmarked ? '#a8a3c7' : '';
  }
}

async function toggleBookmark(): Promise<void> {
  if (!urlbar) return;

  const activeFrame = getActiveFrame();
  if (!activeFrame) return;

  const stripped = stripProxyPrefix(activeFrame.src);
  const decoded = await decodeProxyUrl(stripped);
  const bookmarks = (await ConfigAPI.get('bm')) || [];

  const existingIndex = bookmarks.findIndex(
    (bookmark: any) => normalizeUrl(bookmark.redir) === normalizeUrl(decoded),
  );

  if (existingIndex !== -1) {
    bookmarks.splice(existingIndex, 1);
  } else {
    let hostname = decoded;
    try {
      hostname = new URL(decoded).hostname;
    } catch {
      /* noop */
    }

    bookmarks.push({
      name: activeFrame.contentDocument?.title || decoded,
      logo: `/api/icon/?url=https://${hostname}`,
      redir: decoded,
    });
  }

  await ConfigAPI.set('bm', bookmarks);
  syncFavButton();
}

async function submitUrlbar(): Promise<void> {
  if (!urlbar) return;

  const input = urlbar.value.trim();

  if (internalRoutes[input]) {
    spinReloadIcon();
    navigateTo(internalRoutes[input]);
    return;
  }

  const conn = new BareMux.BareMuxConnection('/bm/worker.js');
  const transport = await conn.getTransport();
  if (transport !== '/lc/index.mjs') {
    await conn.setTransport('/lc/index.mjs', [{ wisp: wispUrl }]);
  }

  const validatedUrl = await validateUrl(input);
  const backend = await ConfigAPI.get('backend');

  const proxyUrl =
    backend === 'u'
      ? `${uvConfig.prefix}${uvConfig.encodeUrl(validatedUrl)}`
      : `${scramjetConfig.prefix}${scramjetConfig.codec.encode(validatedUrl)}`;

  spinReloadIcon();
  navigateTo(proxyUrl);
}

function handleSidebarClick(event: MouseEvent): void {
  const btn = (event.target as HTMLElement).closest('button');
  if (!btn) return;

  event.preventDefault();
  event.stopPropagation();

  const dataUrl = btn.dataset.url;
  if (!dataUrl || !urlbar) return;

  let displayValue = routesByPath[dataUrl];
  if (!displayValue && dataUrl === '/') displayValue = 'lunar://new';

  urlbar.value = displayValue || dataUrl;
  const targetUrl = displayValue ? internalRoutes[displayValue] : dataUrl;

  spinReloadIcon();
  navigateTo(targetUrl);
}

reloadBtn?.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  const history = getTabHistory();
  if (history.index >= 0) navigateTo(history.stack[history.index], false);
});

backBtn?.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  spinReloadIcon();
  goBack();
});

forwardBtn?.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  spinReloadIcon();
  goForward();
});

homeBtn?.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  spinReloadIcon();
  navigateTo('/new');
});

favBtn?.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  toggleBookmark();
});

urlbar?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitUrlbar();
  }
});

sidebar?.addEventListener('click', handleSidebarClick);

TabManager.onUrlChange(syncFavButton);

setup();
