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
  isReady: boolean;
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
const faviconCache = new Map<string, string>();

function nextId(): number {
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

function truncate(str: string, len = 12): string {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

async function fetchFavicon(url: string): Promise<string> {
  if (faviconCache.has(url)) return faviconCache.get(url)!;
  try {
    const transport = await bmConnection.getTransport();
    if (transport !== `/lc/index.mjs`) {
      const wisp = await ConfigAPI.get('wispUrl');
      await bmConnection.setTransport(`/lc/index.mjs`, [{ wisp }]);
    }
    const cleanUrl = decodeURIComponent(url);
    const res = await bmClient.fetch(faviconApi + encodeURIComponent(cleanUrl));
    if (!res.ok) {
      faviconCache.set(url, defaultIcon);
      return defaultIcon;
    }
    const blob = await res.blob();
    return await new Promise<string>(r => {
      const reader = new FileReader();
      reader.onloadend = () => {
        faviconCache.set(url, reader.result as string);
        r(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    faviconCache.set(url, defaultIcon);
    return defaultIcon;
  }
}

function updateTabEl(tab: Tab, field: 'title' | 'icon'): void {
  if (!tab.el) return;
  if (field === 'title') {
    const span = tab.el.querySelector('.tab-title');
    if (span) span.textContent = truncate(tab.title);
  } else {
    const img = tab.el.querySelector<HTMLImageElement>('.tab-favicon');
    if (img && img.src !== tab.favicon) img.src = tab.favicon;
  }
}

function pollTitle(tab: Tab): void {
  if (tab.titleTimer) clearInterval(tab.titleTimer);
  let lastTitle = tab.title;
  tab.titleTimer = window.setInterval(() => {
    try {
      const doc = tab.iframe.contentDocument;
      if (!doc) return;
      let title = doc.title || '';
      try {
        title = decodeURIComponent(title);
      } catch {
        /* noop */
      }
      title = title.trim();
      if (title && title !== lastTitle) {
        lastTitle = title;
        tab.title = title;
        updateTabEl(tab, 'title');
      }
    } catch {
      /* noop */
    }
  }, 1000);
}

async function handleFrameLoad(tab: Tab): Promise<void> {
  try {
    const doc = tab.iframe.contentDocument;
    let pageTitle = doc?.title || '';
    try {
      pageTitle = decodeURIComponent(pageTitle);
    } catch {
      /* noop */
    }
    tab.title = pageTitle.trim() || 'New Tab';
    updateTabEl(tab, 'title');
    pollTitle(tab);

    const pathname = new URL(doc?.location.href || '', location.origin).pathname;
    const decoded = decodeProxyUrl(pathname);
    if (decoded) {
      fetchFavicon(decoded).then(icon => {
        tab.favicon = icon;
        updateTabEl(tab, 'icon');
      });
    } else {
      tab.favicon = defaultIcon;
      updateTabEl(tab, 'icon');
    }

    tab.isReady = true;
    updateUrlBar(tab);
  } catch {
    tab.favicon = defaultIcon;
    updateTabEl(tab, 'icon');
    tab.isReady = true;
  }
}

function updateUrlBar(tab: Tab): void {
  if (tab.id !== activeId) return;
  const urlInput = document.getElementById('urlbar') as HTMLInputElement | null;
  if (!urlInput) return;
  try {
    const doc = tab.iframe.contentDocument;
    if (!doc) return;
    const pathname = new URL(doc.location.href || '', location.origin).pathname;
    const route = Object.entries(internalRoutes).find(([, v]) => v === pathname);
    urlInput.value = route ? route[0] : decodeProxyUrl(pathname);
  } catch {
    /* noop */
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
        encodeProxyUrl(openUrl.toString()).then(proxyUrl => openTab(proxyUrl));
        return null;
      };
    } catch {
      /* noop */
    }
  });
  return frame;
}

function getTabClass(active: boolean): string {
  const base =
    'tab flex items-center justify-between h-[34px] min-w-[160px] max-w-[220px] px-3 rounded-t-lg cursor-pointer select-none transition-all duration-200 relative z-10 border border-b-0 border-[color:var(--border)] gap-2 text-[12.5px]';
  return active
    ? `${base} bg-[color:var(--background)] shadow-[0_2px_12px_#23213640] text-[color:var(--text-header)]`
    : `${base} bg-[color:var(--background-overlay)] hover:bg-[color:var(--background)] text-[color:var(--text-secondary)] opacity-60 hover:opacity-85`;
}

function createTabEl(tab: Tab): HTMLDivElement {
  const el = document.createElement('div');
  el.className = getTabClass(tab.id === activeId);

  const left = document.createElement('div');
  left.className = 'flex items-center gap-1.5 flex-1 min-w-0 h-full';

  const icon = document.createElement('img');
  icon.className = 'tab-favicon flex-shrink-0';
  icon.src = tab.favicon;
  icon.width = 14;
  icon.height = 14;
  icon.style.cssText = 'width:14px;height:14px;object-fit:contain;display:block;';

  const title = document.createElement('span');
  title.className = 'tab-title flex-1 min-w-0';
  title.style.cssText =
    'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1;font-size:12px;';
  title.textContent = truncate(tab.title, 14);

  left.append(icon, title);

  const closeBtn = document.createElement('button');
  closeBtn.className =
    'flex items-center justify-center w-4 h-4 flex-shrink-0 rounded hover:bg-white/15 text-gray-500 hover:text-gray-200 transition-all duration-150';
  closeBtn.innerHTML =
    '<svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L7 7M7 1L1 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  closeBtn.style.cssText = 'padding:0;line-height:1;';
  closeBtn.onclick = (e: MouseEvent) => {
    e.stopPropagation();
    closeTab(tab.id);
  };

  el.append(left, closeBtn);
  el.onclick = () => switchTab(tab.id);
  tab.el = el;
  return el;
}

function renderTabs(): void {
  if (!tabBar) return;
  tabBar.innerHTML = '';
  for (const tab of tabs) {
    tabBar.appendChild(tab.el ?? createTabEl(tab));
  }
}

function updateActive(): void {
  for (const tab of tabs) {
    if (tab.el) tab.el.className = getTabClass(tab.id === activeId);
  }
}

function closeTab(id: number): void {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;

  if (tabs.length === 1) {
    openTab();
    requestAnimationFrame(() => {
      const [removed] = tabs.splice(idx, 1);
      if (removed.titleTimer) clearInterval(removed.titleTimer);
      removed.iframe.remove();
      renderTabs();
    });
    return;
  }

  const [removed] = tabs.splice(idx, 1);
  if (removed.titleTimer) clearInterval(removed.titleTimer);
  removed.iframe.remove();
  if (activeId === id && tabs.length) {
    switchTab(tabs[Math.max(0, idx - 1)].id);
  }
  renderTabs();
}

function showLoader(): void {
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

function hideLoader(): void {
  const bar = document.getElementById('loading-bar') as HTMLDivElement | null;
  if (!bar || !isLoading) return;
  bar.style.cssText =
    'display:block;opacity:1;width:100%;transition:width .2s cubic-bezier(.4,0,.2,1)';
  setTimeout(() => {
    bar.style.cssText = 'display:none;opacity:0;width:0%';
    isLoading = false;
  }, 180);
}

function resetLoader(): void {
  if (loadTimer) {
    clearTimeout(loadTimer);
    loadTimer = null;
  }
  hideLoader();
}

function openTab(src?: string): void {
  const id = nextId();

  if (!frameContainer) {
    document.addEventListener('DOMContentLoaded', () => openTab(src), { once: true });
    return;
  }

  const tab: Tab = {
    id,
    title: 'New Tab',
    favicon: defaultIcon,
    iframe: null as unknown as HTMLIFrameElement,
    isReady: false,
  };

  tabs.push(tab);
  const tabEl = createTabEl(tab);
  if (tabBar) tabBar.appendChild(tabEl);

  requestAnimationFrame(() => {
    const frame = createFrame(id, src);
    tab.iframe = frame;
    frameContainer!.appendChild(frame);
    switchTab(id);

    const urlInput = document.getElementById('urlbar') as HTMLInputElement | null;
    if (urlInput && (!src || src === 'new')) urlInput.value = '';

    frame.onload = () => {
      handleFrameLoad(tab);
      resetLoader();
    };
    frame.onerror = resetLoader;
  });
}

function switchTab(id: number): void {
  activeId = id;

  if (urlWatcher) {
    clearInterval(urlWatcher);
    urlWatcher = null;
  }
  prevHref = '';

  for (const tab of tabs) {
    if (tab.iframe) tab.iframe.classList.toggle('hidden', tab.id !== id);
  }

  updateActive();
  resetLoader();

  const activeTab = tabs.find(t => t.id === id);
  if (activeTab?.isReady) {
    updateUrlBar(activeTab);
    try {
      const doc = activeTab.iframe?.contentDocument;
      if (doc) {
        let title = doc.title || '';
        try {
          title = decodeURIComponent(title);
        } catch {
          /* noop */
        }
        activeTab.title = title.trim() || 'New Tab';
        updateTabEl(activeTab, 'title');

        const pathname = new URL(doc.location.href || '', location.origin).pathname;
        const decoded = decodeProxyUrl(pathname);
        if (decoded) {
          fetchFavicon(decoded).then(icon => {
            activeTab.favicon = icon;
            updateTabEl(activeTab, 'icon');
          });
        }
      }
    } catch {
      /* noop */
    }
  }

  urlWatcher = setInterval(() => {
    if (activeId !== id) return;
    try {
      const tab = tabs.find(t => t.id === id);
      if (!tab?.iframe) return;
      const href = tab.iframe.contentWindow?.location.href;
      if (!href || href === prevHref) return;
      prevHref = href;

      const urlInput = document.getElementById('urlbar') as HTMLInputElement | null;
      if (urlInput) {
        const pathname = new URL(href, location.origin).pathname;
        const route = Object.entries(internalRoutes).find(([, v]) => v === pathname);
        urlInput.value = route ? route[0] : decodeProxyUrl(pathname);
      }

      const doc = tab.iframe.contentDocument;
      if (doc) {
        let title = doc.title || '';
        try {
          title = decodeURIComponent(title);
        } catch {
          /* noop */
        }
        title = title.trim();
        if (title && title !== tab.title) {
          tab.title = title;
          updateTabEl(tab, 'title');
        }

        const pathname = new URL(doc.location.href || '', location.origin).pathname;
        const decoded = decodeProxyUrl(pathname);
        if (decoded) {
          fetchFavicon(decoded).then(icon => {
            tab.favicon = icon;
            updateTabEl(tab, 'icon');
          });
        }
      }

      if (onUrlChange) onUrlChange(href);
    } catch {
      /* noop */
    }
  }, 150);
}

document.addEventListener('DOMContentLoaded', () => {
  tabBar = document.getElementById('tcontainer') as HTMLDivElement | null;
  frameContainer = document.getElementById('fcontainer') as HTMLDivElement | null;
  document.getElementById('add')?.addEventListener('click', () => openTab());

  const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
  urlbar?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') showLoader();
  });

  setInterval(() => {
    if (!isLoading) return;
    const tab = tabs.find(t => t.id === activeId);
    if (tab?.iframe?.contentDocument?.readyState === 'complete') resetLoader();
  }, 400);

  openTab();
});

function cleanup(): void {
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
