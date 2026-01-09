import * as baremux from '@mercuryworkshop/bare-mux';

import ConfigAPI from './config';
import { scramjetWrapper, vWrapper } from './pro';

interface Tab {
  id: number;
  title: string;
  favicon: string;
  iframe: HTMLIFrameElement;
  el?: HTMLDivElement;
  titleTimer?: number;
}

const internalRoutes: Record<string, string> = {
  'lunar://settings': '/st',
  'lunar://new': '/new',
  'lunar://games': '/math',
  'lunar://apps': '/sci',
};

const defaultIcon = '/a/moon.svg';
const faviconApi =
  'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=';
const bmConnection = new baremux.BareMuxConnection(`/bm/worker.js`);
const bmClient = new baremux.BareClient();

const tabs: Tab[] = [];
let activeId: number | null = null;
let idCounter = 1;
let urlWatcher: ReturnType<typeof setInterval> | null = null;
let loadTimer: ReturnType<typeof setTimeout> | null = null;
let isLoading = false;
let prevHref = '';
let onUrlChange: ((href: string) => void) | null = null;

let tabBar: HTMLDivElement | null = null;
let frameContainer: HTMLDivElement | null = null;

function nextId() {
  return idCounter++;
}

function decodeProxyUrl(path: string): string {
  const scPrefix = scramjetWrapper.getConfig().prefix;
  const uvPrefix = vWrapper.getConfig().prefix;

  if (path.startsWith(scPrefix)) {
    const encoded = path.slice(scPrefix.length);
    return decodeURIComponent(scramjetWrapper.getConfig().codec.decode(encoded) || '');
  }
  if (path.startsWith(uvPrefix)) {
    return vWrapper.getConfig().decodeUrl(path.slice(uvPrefix.length));
  }
  return '';
}

async function encodeProxyUrl(url: string): Promise<string> {
  const backend = await ConfigAPI.get('backend');

  if (backend === 'sc') {
    const cfg = scramjetWrapper.getConfig();
    return cfg.prefix + cfg.codec.encode(url);
  }
  if (backend === 'u') {
    const cfg = vWrapper.getConfig();
    return cfg.prefix + cfg.encodeUrl(url);
  }
  return url;
}

function truncate(str: string, len = 18): string {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

async function fetchFavicon(url: string): Promise<string> {
  try {
    const transport = await bmConnection.getTransport();
    if (transport !== `/lc/index.mjs`) {
      const wisp = await ConfigAPI.get('wispUrl');
      await bmConnection.setTransport(`/lc/index.mjs`, [{ wisp }]);
    }
    const res = await bmClient.fetch(faviconApi + encodeURIComponent(url));
    if (!res.ok) return defaultIcon;

    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return defaultIcon;
  }
}

function updateTabEl(tab: Tab, field: 'title' | 'icon') {
  if (!tab.el) return;

  if (field === 'title') {
    const span = tab.el.querySelector<HTMLSpanElement>('.tab-title');
    if (span) span.textContent = truncate(tab.title);
  } else {
    const img = tab.el.querySelector<HTMLImageElement>('.tab-favicon');
    if (img && img.src !== tab.favicon) img.src = tab.favicon;
  }
}

function pollTitle(tab: Tab) {
  if (tab.titleTimer) clearInterval(tab.titleTimer);

  tab.titleTimer = window.setInterval(() => {
    try {
      const doc = tab.iframe.contentDocument;
      const title = doc?.title?.trim();
      if (title && title !== tab.title) {
        tab.title = title;
        updateTabEl(tab, 'title');
      }
    } catch {}
  }, 400);
}

async function handleFrameLoad(tab: Tab) {
  try {
    const doc = tab.iframe.contentDocument;
    tab.title = doc?.title?.trim() || 'New Tab';
    updateTabEl(tab, 'title');
    pollTitle(tab);

    const pathname = new URL(tab.iframe.src, location.origin).pathname;
    const decoded = decodeProxyUrl(pathname);

    tab.favicon = decoded ? await fetchFavicon(decoded) : defaultIcon;
    updateTabEl(tab, 'icon');
  } catch {
    tab.favicon = defaultIcon;
    updateTabEl(tab, 'icon');
  }
}

function createFrame(id: number, src?: string): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.id = `frame-${id}`;
  frame.src = src ?? 'new';
  frame.className = 'w-full z-0 h-full hidden';
  frame.setAttribute(
    'sandbox',
    'allow-scripts allow-popups allow-modals allow-top-navigation allow-pointer-lock allow-same-origin allow-forms',
  );

  frame.addEventListener('load', () => {
    try {
      const win = frame.contentWindow;
      if (!win) return;

      win.open = (openUrl?: string | URL) => {
        if (!openUrl) return null;
        encodeProxyUrl(openUrl.toString()).then(openTab);
        return null;
      };
    } catch {}
  });

  return frame;
}

function getTabClass(active: boolean): string {
  const base =
    'tab flex items-center justify-between h-10 min-w-[220px] px-3 py-2 rounded-t-2xl cursor-pointer select-none transition-all duration-200 shadow-sm relative z-10';
  return active
    ? `${base} bg-[#34324d] shadow-[0_0_8px_#5c59a5] border-t-2 border-[#5c59a5]`
    : `${base} bg-[#2a283e] hover:bg-[#323048]`;
}

function createTabEl(tab: Tab): HTMLDivElement {
  const el = document.createElement('div');
  el.className = getTabClass(tab.id === activeId);

  const left = document.createElement('div');
  left.className = 'flex items-center gap-2 overflow-hidden h-full';

  const icon = document.createElement('img');
  icon.className = 'tab-favicon w-4 h-4';
  icon.src = tab.favicon;

  const title = document.createElement('span');
  title.className = 'tab-title truncate';
  title.textContent = truncate(tab.title);

  left.append(icon, title);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'text-lg hover:text-red-400 transition-colors';
  closeBtn.textContent = '✕';
  closeBtn.onclick = e => {
    e.stopPropagation();
    closeTab(tab.id);
  };

  el.append(left, closeBtn);
  el.onclick = () => switchTab(tab.id);
  tab.el = el;

  return el;
}

function renderTabs() {
  if (!tabBar) return;
  tabBar.innerHTML = '';
  for (const tab of tabs) {
    tabBar.appendChild(tab.el ?? createTabEl(tab));
  }
}

function updateActiveStyles() {
  for (const tab of tabs) {
    if (tab.el) tab.el.className = getTabClass(tab.id === activeId);
  }
}

function closeTab(id: number) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;

  if (tabs.length <= 1) openTab();

  const [removed] = tabs.splice(idx, 1);
  if (removed.titleTimer) clearInterval(removed.titleTimer);
  removed.iframe.remove();

  if (activeId === id && tabs.length) {
    switchTab(tabs[Math.max(0, idx - 1)].id);
  }
  renderTabs();
}

function showLoader() {
  const bar = document.getElementById('loading-bar') as HTMLDivElement | null;
  if (!bar || isLoading) return;

  isLoading = true;
  bar.style.cssText = 'display:block;opacity:1;width:0%;transition:none';

  requestAnimationFrame(() => {
    if (!isLoading) return;
    bar.style.cssText =
      'display:block;opacity:1;width:80%;transition:width .5s cubic-bezier(.4,0,.2,1)';
  });

  loadTimer = setTimeout(() => {
    if (isLoading && bar) {
      bar.style.transition = 'width .3s cubic-bezier(.4,0,.2,1)';
      bar.style.width = '90%';
    }
  }, 1200);
}

function hideLoader() {
  const bar = document.getElementById('loading-bar') as HTMLDivElement | null;
  if (!bar || !isLoading) return;

  bar.style.cssText =
    'display:block;opacity:1;width:100%;transition:width .2s cubic-bezier(.4,0,.2,1)';

  setTimeout(() => {
    bar.style.cssText = 'display:none;opacity:0;width:0%';
    isLoading = false;
  }, 180);
}

function resetLoader() {
  if (loadTimer) {
    clearTimeout(loadTimer);
    loadTimer = null;
  }
  hideLoader();
}

function openTab(src?: string) {
  const id = nextId();
  const frame = createFrame(id, src);
  if (!frameContainer) {
    document.addEventListener('DOMContentLoaded', () => openTab(src), { once: true });
    return;
  }
  frameContainer.appendChild(frame);

  const tab: Tab = { id, title: 'New Tab', favicon: defaultIcon, iframe: frame };
  tabs.push(tab);
  renderTabs();
  switchTab(id);

  frame.onload = () => {
    handleFrameLoad(tab);
    resetLoader();
  };
  frame.onerror = resetLoader;
}

function switchTab(id: number) {
  if (urlWatcher) clearInterval(urlWatcher);

  activeId = id;
  prevHref = '';

  for (const tab of tabs) {
    tab.iframe.classList.toggle('hidden', tab.id !== id);
  }
  updateActiveStyles();
  resetLoader();

  const urlInput = document.getElementById('urlbar') as HTMLInputElement | null;

  urlWatcher = setInterval(() => {
    try {
      const tab = tabs.find(t => t.id === id);
      const href = tab?.iframe.contentWindow?.location.href;
      if (!href || href === prevHref) return;

      prevHref = href;

      if (urlInput) {
        const pathname = new URL(href, location.origin).pathname;
        const route = Object.entries(internalRoutes).find(([, v]) => v === pathname);
        urlInput.value = route ? route[0] : decodeProxyUrl(pathname);
      }

      if (onUrlChange) onUrlChange(href);
    } catch {}
  }, 250);
}

document.addEventListener('DOMContentLoaded', () => {
  tabBar = document.getElementById('tcontainer') as HTMLDivElement | null;
  frameContainer = document.getElementById('fcontainer') as HTMLDivElement | null;
  document.getElementById('add')?.addEventListener('click', () => openTab());

  const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
  urlbar?.addEventListener('keydown', e => {
    if (e.key === 'Enter') showLoader();
  });

  setInterval(() => {
    if (!isLoading) return;
    const tab = tabs.find(t => t.id === activeId);
    if (tab?.iframe.contentDocument?.readyState === 'complete') resetLoader();
  }, 400);

  openTab();
});

function cleanup() {
  if (urlWatcher) {
    clearInterval(urlWatcher);
    urlWatcher = null;
  }
  if (loadTimer) {
    clearTimeout(loadTimer);
    loadTimer = null;
  }
  for (const tab of tabs) {
    if (tab.titleTimer) clearInterval(tab.titleTimer);
  }
}

window.addEventListener('unload', cleanup);

export const TabManager = {
  get activeTabId() {
    return activeId;
  },
  set activeTabId(id: number | null) {
    if (id !== null) switchTab(id);
  },
  openTab,
  onUrlChange: (cb: (href: string) => void) => {
    onUrlChange = cb;
  },
};

(globalThis as any).TabManager = TabManager;
