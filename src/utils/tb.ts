import ConfigAPI from './config';
import { scramjetWrapper, vWrapper } from './pro';
import { shadow, ready } from './shadow';

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

let bmClient: any = null;
function getBmClient() {
  if (!bmClient) bmClient = new BareMux.BareClient();
  return bmClient;
}

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

let urlInput: HTMLInputElement | null = null;
let loadingBar: HTMLDivElement | null = null;

const faviconCache = new Map<string, string>();
const pendingFavicons = new Map<string, Promise<string>>();
let transportReady = false;

function decodeProxyUrl(href: string): string {
  let path: string;
  try {
    const url = new URL(href, location.origin);
    path = url.pathname + url.search + url.hash;
  } catch {
    path = href;
  }

  const scPrefix = scramjetWrapper.getConfig().prefix;
  const uvPrefix = vWrapper.getConfig().prefix;

  if (path.startsWith(scPrefix)) {
    try {
      return decodeURIComponent(
        scramjetWrapper.getConfig().codec.decode(path.slice(scPrefix.length)) || ''
      );
    } catch {
      return '';
    }
  }

  if (path.startsWith(uvPrefix)) {
    try {
      return vWrapper.getConfig().decodeUrl(path.slice(uvPrefix.length));
    } catch {
      return '';
    }
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

const TAB_TITLE_MAX = 20;
function truncate(str: string, len = TAB_TITLE_MAX): string {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

async function ensureTransport(): Promise<void> {
  if (transportReady) return;
  const conn = new BareMux.BareMuxConnection('/bm/worker.js');
  const [transport, wisp] = await Promise.all([
    ConfigAPI.get('transport'),
    ConfigAPI.get('wispUrl'),
  ]);
  const current = await conn.getTransport();
  if (transport === 'ep' && current !== '/ep/index.mjs') {
    await conn.setTransport('/ep/index.mjs', [{ wisp }]);
  } else if (transport === 'lc' && current !== '/lc/index.mjs') {
    await conn.setTransport('/lc/index.mjs', [{ wisp }]);
  }
  transportReady = true;
}

async function fetchFavicon(url: string): Promise<string> {
  if (url.startsWith('lunar://')) return defaultIcon;
  const cached = faviconCache.get(url);
  if (cached) return cached;
  const pending = pendingFavicons.get(url);
  if (pending) return pending;

  const p = (async () => {
    try {
      await ensureTransport();
      const res = await getBmClient().fetch(
        faviconApi + encodeURIComponent(decodeURIComponent(url))
      );
      if (!res.ok) {
        faviconCache.set(url, defaultIcon);
        return defaultIcon;
      }
      const blob = await res.blob();
      return await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          faviconCache.set(url, result);
          resolve(result);
        };
        reader.readAsDataURL(blob);
      });
    } catch {
      faviconCache.set(url, defaultIcon);
      return defaultIcon;
    } finally {
      pendingFavicons.delete(url);
    }
  })();

  pendingFavicons.set(url, p);
  return p;
}

function updateTabEl(tab: Tab, field: 'title' | 'icon'): void {
  if (!tab.el) return;
  if (field === 'title') {
    const span = tab.el.querySelector('.tab-title');
    if (span) span.textContent = truncate(tab.title, TAB_TITLE_MAX);
  } else {
    const img = tab.el.querySelector<HTMLImageElement>('.tab-favicon');
    if (img && img.src !== tab.favicon) img.src = tab.favicon;
  }
}

function getDisplayUrl(iframeHref: string): string {
  try {
    const url = new URL(iframeHref, location.origin);
    const fullPath = url.pathname + url.search + url.hash;
    for (const [key, val] of Object.entries(internalRoutes)) {
      if (val === url.pathname) return key;
    }
    return decodeProxyUrl(fullPath) || '';
  } catch {
    return '';
  }
}

function resolveTitle(doc: Document | null, iframeHref: string): string {
  let title = doc?.title || '';
  try {
    title = decodeURIComponent(title);
  } catch {}
  title = title.trim();
  if (title) return title;

  const decoded = getDisplayUrl(iframeHref);
  try {
    const url = new URL(iframeHref, location.origin);
    if (url.pathname !== '/new' && decoded) return new URL(decoded).hostname;
  } catch {}
  return 'New Tab';
}

function syncTab(tab: Tab): void {
  try {
    const doc = tab.iframe.contentDocument;
    if (!doc) return;

    const href = doc.location.href || '';
    const title = resolveTitle(doc, href);
    if (title !== tab.title) {
      tab.title = title;
      updateTabEl(tab, 'title');
    }

    const decoded = getDisplayUrl(href);
    if (decoded) {
      fetchFavicon(decoded).then(icon => {
        if (icon !== tab.favicon) {
          tab.favicon = icon;
          updateTabEl(tab, 'icon');
        }
      });
    } else if (tab.favicon !== defaultIcon) {
      tab.favicon = defaultIcon;
      updateTabEl(tab, 'icon');
    }
  } catch {}
}

function pollTitle(tab: Tab): void {
  if (tab.titleTimer) clearInterval(tab.titleTimer);
  tab.titleTimer = window.setInterval(() => syncTab(tab), 2000);
}

function handleFrameLoad(tab: Tab): void {
  syncTab(tab);
  pollTitle(tab);
  tab.isReady = true;
  updateUrlBar(tab);
}

function updateUrlBar(tab: Tab): void {
  if (tab.id !== activeId || !urlInput) return;
  try {
    const doc = tab.iframe.contentDocument;
    if (!doc) return;
    urlInput.value = getDisplayUrl(doc.location.href || '');
  } catch {}
}

function leavesTab(el: HTMLElement): boolean {
  if (el.tagName === 'A' || el.tagName === 'AREA') {
    const t = (el as HTMLAnchorElement).target;
    return t === '_blank' || t === '_new';
  }
  return false;
}

function interceptLink(el: HTMLElement): void {
  if (!leavesTab(el) || (el as any).__lr) return;
  (el as any).__lr = true;
  if (location.href === location.origin + '/welcome') return;
  el.addEventListener('click', e => {
    if (!leavesTab(el)) return;
    e.preventDefault();
    const href = (el as HTMLAnchorElement).href;
    if (href) encodeProxyUrl(href).then(u => openTab(u));
  });
}

const linkSelector =
  'a[target="_blank"], a[target="_new"], area[target="_blank"], area[target="_new"]';

function createFrame(id: number, src?: string): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.id = `frame-${id}`;
  frame.src = src ?? 'new';
  frame.className = 'w-full z-0 h-full hidden';
  frame.setAttribute(
    'sandbox',
    'allow-scripts allow-popups allow-modals allow-top-navigation allow-pointer-lock allow-same-origin allow-forms'
  );
  frame.addEventListener('load', () => {
    try {
      const win = frame.contentWindow;
      const doc = frame.contentDocument;
      if (!win || !doc) return;

      win.open = (openUrl?: string | URL) => {
        if (!openUrl) return null;
        encodeProxyUrl(openUrl.toString()).then(u => openTab(u));
        return null;
      };

      doc.querySelectorAll<HTMLElement>(linkSelector).forEach(interceptLink);

      new MutationObserver(muts => {
        for (let i = 0; i < muts.length; i++) {
          const m = muts[i];
          if (m.type === 'childList') {
            for (let j = 0; j < m.addedNodes.length; j++) {
              const node = m.addedNodes[j];
              if (node.nodeType !== 1) continue;
              const el = node as HTMLElement;
              if (el.matches('a, area')) interceptLink(el);
              el.querySelectorAll<HTMLElement>(linkSelector).forEach(interceptLink);
            }
          } else if (m.type === 'attributes' && m.attributeName === 'target') {
            const el = m.target as HTMLElement;
            if (el.matches('a, area')) interceptLink(el);
          }
        }
      }).observe(doc.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['target'],
      });
    } catch {}
  });
  return frame;
}

const tabBaseClass =
  'tab flex items-center justify-between h-[34px] min-w-[160px] max-w-[220px] px-3 rounded-t-lg cursor-pointer select-none transition-all duration-200 relative z-10 border border-b-0 border-[color:var(--border)] gap-2 text-[12px]';
const tabActiveClass =
  tabBaseClass +
  ' bg-[color:var(--background)] shadow-[0_2px_12px_#23213640] text-[color:var(--text-header)]';
const tabInactiveClass =
  tabBaseClass +
  ' bg-[color:var(--background-overlay)] hover:bg-[color:var(--background)] text-[color:var(--text-secondary)] opacity-60 hover:opacity-85';

function createTabEl(tab: Tab): HTMLDivElement {
  const el = document.createElement('div');
  el.className = tab.id === activeId ? tabActiveClass : tabInactiveClass;
  const left = document.createElement('div');
  left.className = 'flex items-center gap-2 flex-1 min-w-0';
  left.style.cssText = 'height:100%;align-items:center;';

  const icon = document.createElement('img');
  icon.className = 'tab-favicon flex-shrink-0';
  icon.src = tab.favicon;
  icon.width = 15;
  icon.height = 15;
  icon.style.cssText =
    'width:15px;height:15px;object-fit:contain;display:block;' +
    'image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges;flex-shrink:0;';

  const title = document.createElement('span');
  title.className = 'tab-title flex-1 min-w-0';
  title.style.cssText =
    'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
    'line-height:1.4;font-size:12.5px;display:block;';
  title.textContent = truncate(tab.title, TAB_TITLE_MAX);

  left.append(icon, title);

  const closeBtn = document.createElement('button');
  closeBtn.className =
    'flex items-center justify-center flex-shrink-0 rounded ' +
    'hover:bg-white/15 text-gray-500 hover:text-gray-200 transition-all duration-150';
  closeBtn.style.cssText =
    'padding:0;line-height:1;width:16px;height:16px;display:flex;align-items:center;justify-content:center;';
  closeBtn.innerHTML =
    '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" ' +
    'xmlns="http://www.w3.org/2000/svg" style="display:block;">' +
    '<path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.75" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
  const keep = new Set<Node>();
  for (const tab of tabs) {
    const el = tab.el ?? createTabEl(tab);
    keep.add(el);
    tabBar.appendChild(el);
  }
  for (let i = tabBar.children.length - 1; i >= 0; i--) {
    const child = tabBar.children[i];
    if (!keep.has(child)) child.remove();
  }
}

function updateActive(): void {
  for (const tab of tabs) {
    if (tab.el) tab.el.className = tab.id === activeId ? tabActiveClass : tabInactiveClass;
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
      if (removed.el) removed.el.remove();
      renderTabs();
    });
    return;
  }

  const [removed] = tabs.splice(idx, 1);
  if (removed.titleTimer) clearInterval(removed.titleTimer);
  removed.iframe.remove();
  if (removed.el) removed.el.remove();
  if (activeId === id && tabs.length) switchTab(tabs[Math.max(0, idx - 1)].id);
  renderTabs();
}

function showLoader(): void {
  if (!loadingBar || isLoading) return;
  isLoading = true;
  loadingBar.style.cssText = 'display:block;opacity:1;width:0%;transition:none';
  requestAnimationFrame(() => {
    if (!isLoading || !loadingBar) return;
    loadingBar.style.cssText =
      'display:block;opacity:1;width:80%;transition:width .5s cubic-bezier(.4,0,.2,1)';
  });
  loadTimer = setTimeout(() => {
    if (isLoading && loadingBar) {
      loadingBar.style.transition = 'width .3s cubic-bezier(.4,0,.2,1)';
      loadingBar.style.width = '90%';
    }
  }, 1200);
}

function hideLoader(): void {
  if (!loadingBar || !isLoading) return;
  loadingBar.style.cssText =
    'display:block;opacity:1;width:100%;transition:width .2s cubic-bezier(.4,0,.2,1)';
  setTimeout(() => {
    if (loadingBar) loadingBar.style.cssText = 'display:none;opacity:0;width:0%';
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
  if (!frameContainer) {
    ready.then(() => openTab(src));
    return;
  }

  const id = idCounter++;
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

  const frame = createFrame(id, src);
  tab.iframe = frame;
  frameContainer.appendChild(frame);
  switchTab(id);

  if (urlInput && (!src || src === 'new')) urlInput.value = 'lunar://new';

  frame.onload = () => {
    handleFrameLoad(tab);
    resetLoader();
  };
  frame.onerror = resetLoader;
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

  const active = tabs.find(t => t.id === id);
  if (active?.isReady) {
    syncTab(active);
    updateUrlBar(active);
  }

  urlWatcher = setInterval(() => {
    if (activeId !== id) return;
    try {
      const tab = tabs.find(t => t.id === id);
      if (!tab?.iframe) return;
      const href = tab.iframe.contentWindow?.location.href;
      if (!href || href === prevHref) return;
      prevHref = href;
      if (urlInput) urlInput.value = getDisplayUrl(href);
      syncTab(tab);
      if (onUrlChange) onUrlChange(href);
    } catch {}
  }, 250);
}

ready.then(() => {
  tabBar = shadow.querySelector('#tcontainer') as HTMLDivElement | null;
  frameContainer = shadow.querySelector('#fcontainer') as HTMLDivElement | null;
  urlInput = shadow.querySelector('#urlbar') as HTMLInputElement | null;
  loadingBar = shadow.querySelector('#loading-bar') as HTMLDivElement | null;

  shadow.querySelector('#add')?.addEventListener('click', () => openTab());

  urlInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') showLoader();
  });

  setInterval(() => {
    if (!isLoading) return;
    const tab = tabs.find(t => t.id === activeId);
    if (tab?.iframe?.contentDocument?.readyState === 'complete') resetLoader();
  }, 400);

  openTab();
});

window.addEventListener('unload', () => {
  if (urlWatcher) clearInterval(urlWatcher);
  if (loadTimer) clearTimeout(loadTimer);
  for (const tab of tabs) {
    if (tab.titleTimer) clearInterval(tab.titleTimer);
  }
});

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
