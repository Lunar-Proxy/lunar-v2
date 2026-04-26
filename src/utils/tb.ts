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
  pendingSrc?: string; // lazy load: URL to load when tab is first activated
}

interface SavedTab {
  url: string;
  title: string;
  favicon: string;
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
let isRestoring = false;

const reverseInternalRoutes = Object.fromEntries(
  Object.entries(internalRoutes).map(([k, v]) => [v, k]),
);

function getPersistableUrl(tab: Tab): string | null {
  try {
    const href = tab.iframe?.contentWindow?.location.href || tab.iframe?.src;
    if (!href) return null;

    const url = new URL(href, location.origin);
    const pathname = url.pathname;

    // Check internal routes
    const route = reverseInternalRoutes[pathname];
    if (route) return route;

    // Skip blank/new tabs early
    if (pathname === '/new' || pathname === '/' || href === 'about:blank') return null;

    // Only attempt decode if it looks like a proxy path
    const scPrefix = scramjetWrapper.getConfig().prefix;
    const uvPrefix = vWrapper.getConfig().prefix;
    const isProxyPath = pathname.startsWith(scPrefix) || pathname.startsWith(uvPrefix);

    if (isProxyPath) {
      const decoded = decodeProxyUrl(pathname);
      // Only persist if we got a valid canonical URL back
      if (decoded && /^https?:\/\//.test(decoded)) return decoded;
      // Could not decode — don't persist garbage
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

async function resolveRestoredUrl(saved: string): Promise<string> {
  // Internal routes
  if (internalRoutes[saved]) return internalRoutes[saved];

  // External URL — encode with current backend
  return encodeProxyUrl(saved);
}

async function saveTabs(): Promise<void> {
  if (isRestoring) return;
  try {
    const saved: SavedTab[] = [];
    for (const tab of tabs) {
      const url = tab.pendingSrc
        ? tab.pendingSrc // lazy tab — save the pending URL as-is (already canonical)
        : getPersistableUrl(tab);
      if (url) {
        saved.push({
          url,
          title: tab.title || 'New Tab',
          favicon: tab.favicon || defaultIcon,
        });
      }
    }
    const activeIndex = tabs.findIndex(t => t.id === activeId);
    await ConfigAPI.set('savedTabs', saved);
    await ConfigAPI.set('activeTabIndex', Math.max(0, activeIndex));
  } catch (err) {
    console.warn('[Lunar] Failed to save tabs:', err);
  }
}

async function restoreTabs(): Promise<void> {
  isRestoring = true;
  try {
    const saved = await ConfigAPI.get('savedTabs');
    if (!Array.isArray(saved) || saved.length === 0) {
      openTab();
      return;
    }

    // Support both old format (string[]) and new format (SavedTab[])
    const entries: SavedTab[] = saved
      .map((entry: unknown) => {
        if (typeof entry === 'string') {
          let title = entry;
          try { title = entry.startsWith('lunar://') ? entry : new URL(entry).hostname; } catch {}
          return { url: entry, title, favicon: defaultIcon };
        }
        if (entry && typeof entry === 'object' && 'url' in entry) return entry as SavedTab;
        return null;
      })
      .filter((e): e is SavedTab => e !== null && typeof e.url === 'string' && e.url.length > 0);

    if (entries.length === 0) {
      openTab();
      return;
    }

    // Ensure transport is ready before loading any proxy content
    try {
      const { ensureTransport } = await import('./navigation');
      await ensureTransport();
    } catch {}

    const savedIndex = (await ConfigAPI.get('activeTabIndex')) as number | null;
    const activeIdx = typeof savedIndex === 'number' && savedIndex < entries.length ? savedIndex : 0;

    for (let i = 0; i < entries.length; i++) {
      const { url, title, favicon } = entries[i];
      const isActive = i === activeIdx;

      try {
        if (isActive) {
          // Active tab: load immediately
          const resolved = await resolveRestoredUrl(url);
          openTab(resolved, { activate: true, persist: false, initialTitle: title, initialFavicon: favicon });
        } else {
          // Inactive tabs: create lazy — don't load until clicked
          openTab(undefined, {
            activate: false,
            persist: false,
            initialTitle: title,
            initialFavicon: favicon,
            lazySrc: url,
          });
        }
      } catch {
        // Skip invalid tab
      }
    }

    if (tabs.length === 0) openTab();
  } catch (err) {
    console.warn('[Lunar] Failed to restore tabs:', err);
    if (tabs.length === 0) openTab();
  } finally {
    isRestoring = false;
  }
}

function nextId() {
  return idCounter++;
}

function decodeProxyUrl(path: string): string {
  try {
    const scPrefix = scramjetWrapper.getConfig().prefix;
    const uvPrefix = vWrapper.getConfig().prefix;
    if (path.startsWith(scPrefix)) {
      const encoded = path.slice(scPrefix.length);
      // codec.decode already calls decodeURIComponent — don't double-decode
      const decoded = scramjetWrapper.getConfig().codec.decode(encoded);
      return decoded || '';
    }
    if (path.startsWith(uvPrefix)) {
      return vWrapper.getConfig().decodeUrl(path.slice(uvPrefix.length));
    }
  } catch {}
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
    return await new Promise(r => {
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

function updateTabEl(tab: Tab, field: 'title' | 'icon') {
  if (!tab.el) return;
  if (field === 'title') {
    const span = tab.el.querySelector('.tab-title');
    if (span) span.textContent = truncate(tab.title);
  } else {
    const img = tab.el.querySelector('.tab-favicon') as HTMLImageElement | null;
    if (img && img.src !== tab.favicon) {
      img.src = tab.favicon;
    }
  }
}

function pollTitle(tab: Tab) {
  if (tab.titleTimer) clearInterval(tab.titleTimer);
  let lastTitle = tab.title;
  tab.titleTimer = window.setInterval(() => {
    try {
      const doc = tab.iframe.contentDocument;
      if (!doc) return;
      let title = doc.title || '';
      try {
        title = decodeURIComponent(title);
      } catch {}
      title = title.trim();
      if (title && title !== lastTitle) {
        lastTitle = title;
        tab.title = title;
        updateTabEl(tab, 'title');
      }
    } catch {}
  }, 1000);
}

async function handleFrameLoad(tab: Tab) {
  try {
    const doc = tab.iframe.contentDocument;
    let pageTitle = doc?.title || '';
    try {
      pageTitle = decodeURIComponent(pageTitle);
    } catch {}
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

function updateUrlBar(tab: Tab) {
  if (tab.id !== activeId) return;

  const urlInput = document.getElementById('urlbar') as HTMLInputElement | null;
  if (!urlInput) return;

  try {
    const doc = tab.iframe.contentDocument;
    if (!doc) return;

    const pathname = new URL(doc.location.href || '', location.origin).pathname;
    const route = Object.entries(internalRoutes).find(([, v]) => v === pathname);
    urlInput.value = route ? route[0] : decodeProxyUrl(pathname);
  } catch {}
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
      const doc = frame.contentDocument;
      if (!win || !doc) return;
      win.open = (openUrl?: string | URL) => {
        if (!openUrl) return null;
        encodeProxyUrl(openUrl.toString()).then(proxyUrl => {
          openTab(proxyUrl);
        });
        return null;
      };
    } catch {}
  });
  return frame;
}

function getTabClass(active: boolean): string {
  const base =
    'tab flex items-center justify-between h-10 min-w-[180px] max-w-[200px] px-3 py-2 rounded-t-xl cursor-pointer select-none transition-all duration-200 relative z-10 mx-0.5 border border-b-0 border-[color:var(--border)] gap-2';
  return active
    ? `${base} bg-[color:var(--background)] shadow-[0_4px_16px_#23213660] text-[color:var(--text-header)]`
    : `${base} bg-[color:var(--background-overlay)] hover:bg-[color:var(--background)] text-[color:var(--text-secondary)] opacity-70 hover:opacity-90`;
}

function createTabEl(tab: Tab): HTMLDivElement {
  const el = document.createElement('div');
  el.className = getTabClass(tab.id === activeId);

  const left = document.createElement('div');
  left.className = 'flex items-center gap-2 flex-1 min-w-0';
  left.style.height = '100%';

  const icon = document.createElement('img');
  icon.className = 'tab-favicon flex-shrink-0';
  icon.src = tab.favicon;
  icon.width = 16;
  icon.height = 16;
  icon.style.width = '16px';
  icon.style.height = '16px';
  icon.style.objectFit = 'contain';
  icon.style.display = 'block';

  const title = document.createElement('span');
  title.className = 'tab-title truncate text-sm font-normal flex-1 min-w-0';
  title.style.overflow = 'hidden';
  title.style.textOverflow = 'ellipsis';
  title.style.whiteSpace = 'nowrap';
  title.style.lineHeight = '1';
  title.style.display = 'flex';
  title.style.alignItems = 'center';
  title.textContent = truncate(tab.title, 14);

  left.append(icon, title);

  const closeBtn = document.createElement('button');
  closeBtn.className =
    'flex items-center justify-center w-5 h-5 flex-shrink-0 rounded-full bg-transparent hover:bg-[color:var(--background-disabled)] text-[color:var(--text-secondary)] hover:text-red-400 transition-all duration-200 text-base leading-none';
  closeBtn.textContent = '×';
  closeBtn.style.fontWeight = '400';
  closeBtn.style.padding = '0';
  closeBtn.style.lineHeight = '1';
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
  const existingTabs = tabBar.querySelectorAll('.tab');
  const hasChanges = existingTabs.length !== tabs.length;

  if (!hasChanges) return;

  tabBar.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-center justify-center w-full';
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'flex items-center gap-0';
  for (const tab of tabs) {
    tabsContainer.appendChild(tab.el ?? createTabEl(tab));
  }
  wrapper.appendChild(tabsContainer);
  tabBar.appendChild(wrapper);
}

function updateActive() {
  for (const tab of tabs) {
    if (tab.el) tab.el.className = getTabClass(tab.id === activeId);
  }
}

function closeTab(id: number) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;

  if (tabs.length === 1) {
    openTab(undefined, { persist: false });
    requestAnimationFrame(() => {
      const [removed] = tabs.splice(idx, 1);
      if (removed.titleTimer) clearInterval(removed.titleTimer);
      removed.iframe.remove();
      renderTabs();
      void saveTabs();
    });
    return;
  }

  const [removed] = tabs.splice(idx, 1);
  if (removed.titleTimer) clearInterval(removed.titleTimer);
  removed.iframe.remove();
  if (activeId === id && tabs.length) {
    const newActiveId = tabs[Math.max(0, idx - 1)].id;
    switchTab(newActiveId);
  }
  renderTabs();
  void saveTabs();
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

interface OpenTabOpts {
  activate?: boolean;
  persist?: boolean;
  initialTitle?: string;
  initialFavicon?: string;
  lazySrc?: string; // canonical URL to load when tab is first activated
}

function openTab(src?: string, opts?: OpenTabOpts) {
  const {
    activate = true,
    persist = true,
    initialTitle = 'New Tab',
    initialFavicon = defaultIcon,
    lazySrc,
  } = opts ?? {};
  const id = nextId();

  if (!frameContainer) {
    document.addEventListener('DOMContentLoaded', () => openTab(src, opts), { once: true });
    return;
  }

  const tab: Tab = {
    id,
    title: initialTitle,
    favicon: initialFavicon,
    iframe: null as any,
    isReady: false,
    ...(lazySrc ? { pendingSrc: lazySrc } : {}),
  };

  tabs.push(tab);

  const tabEl = createTabEl(tab);
  if (tabBar) {
    const wrapper =
      tabBar.querySelector('.flex.items-center.justify-center') || document.createElement('div');
    wrapper.className = 'flex items-center justify-center w-full';
    const container =
      wrapper.querySelector('.flex.items-center.gap-0') || document.createElement('div');
    container.className = 'flex items-center gap-0';
    container.appendChild(tabEl);
    if (!wrapper.parentElement) {
      wrapper.appendChild(container);
      tabBar.appendChild(wrapper);
    }
  }

  // Lazy tabs: don't create iframe until activated
  if (lazySrc && !activate) {
    // Tab element is in the tab bar but no iframe yet — will load on switchTab
    return;
  }

  requestAnimationFrame(() => {
    const frame = createFrame(id, src);
    tab.iframe = frame;
    frameContainer!.appendChild(frame);

    if (activate) {
      switchTab(id);
    }

    const urlInput = document.getElementById('urlbar') as HTMLInputElement | null;
    if (urlInput && (!src || src === 'new')) urlInput.value = '';

    frame.onload = () => {
      handleFrameLoad(tab);
      resetLoader();
      if (persist) void saveTabs();
    };
    frame.onerror = resetLoader;
  });
}

function switchTab(id: number) {
  activeId = id;

  if (urlWatcher) {
    clearInterval(urlWatcher);
    urlWatcher = null;
  }

  prevHref = '';

  // Lazy load: if this tab has a pending URL but no iframe yet, create it now
  const lazyTab = tabs.find(t => t.id === id);
  if (lazyTab && lazyTab.pendingSrc && !lazyTab.iframe) {
    const pending = lazyTab.pendingSrc;
    delete lazyTab.pendingSrc;

    // Ensure transport is ready before loading proxy content
    (async () => {
      try {
        const { ensureTransport } = await import('./navigation');
        await ensureTransport();
      } catch {}
      const resolved = await resolveRestoredUrl(pending);
      if (!frameContainer) return;
      const frame = createFrame(id, resolved);
      lazyTab.iframe = frame;
      frameContainer.appendChild(frame);
      frame.classList.remove('hidden');

      frame.onload = () => {
        handleFrameLoad(lazyTab);
        resetLoader();
        void saveTabs();
      };
      frame.onerror = resetLoader;
      showLoader();
    })();
  }

  for (const tab of tabs) {
    if (tab.iframe) tab.iframe.classList.toggle('hidden', tab.id !== id);
  }

  updateActive();
  resetLoader();

  const activeTab = tabs.find(t => t.id === id);
  if (activeTab && activeTab.isReady) {
    updateUrlBar(activeTab);

    try {
      const doc = activeTab.iframe?.contentDocument;
      if (doc) {
        let title = doc.title || '';
        try {
          title = decodeURIComponent(title);
        } catch {}
        title = title.trim();
        activeTab.title = title || 'New Tab';
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
    } catch {}
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

      if (tab) {
        const doc = tab.iframe.contentDocument;
        if (doc) {
          let title = doc.title || '';
          try {
            title = decodeURIComponent(title);
          } catch {}
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
      }
      if (onUrlChange) onUrlChange(href);
    } catch {}
  }, 150);
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
    if (tab?.iframe?.contentDocument?.readyState === 'complete') resetLoader();
  }, 400);
  restoreTabs();
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
  saveTabs,
  onUrlChange: (cb: (href: string) => void) => {
    onUrlChange = cb;
  },
};

(globalThis as any).TabManager = TabManager;
