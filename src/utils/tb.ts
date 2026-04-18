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
const getBmClient = () => bmClient ?? (bmClient = new BareMux.BareClient());

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
let hlLayer: HTMLDivElement | null = null;
let isTyping = false;
const faviconCache = new Map<string, string>();
const pendingFavicons = new Map<string, Promise<string>>();
let transportReady = false;
let transportInitPromise: Promise<void> | null = null;

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const escHtml = (s: string) => s.replace(/[&<>]/g, c => ESC[c]);

let lastHighlightVal = '';
function renderHighlight(raw: string) {
  if (!hlLayer || raw === lastHighlightVal) return;
  lastHighlightVal = raw;

  if (!raw) {
    hlLayer.innerHTML = '';
    return;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    hlLayer.innerHTML = `<span class="hl-dim">${escHtml(raw)}</span>`;
    return;
  }

  const host = url.hostname;
  const idx = raw.indexOf(host);
  if (idx === -1) {
    hlLayer.innerHTML = `<span class="hl-dim">${escHtml(raw)}</span>`;
    return;
  }

  hlLayer.innerHTML =
    `<span class="hl-dim">${escHtml(raw.slice(0, idx))}</span>` +
    `<span class="hl-host">${escHtml(host)}</span>` +
    `<span class="hl-dim">${escHtml(raw.slice(idx + host.length))}</span>`;
}

const syncHlScroll = () => {
  if (urlInput && hlLayer) hlLayer.scrollLeft = urlInput.scrollLeft;
};

function setUrlDisplay(val: string) {
  if (!urlInput) return;
  urlInput.value = val;
  renderHighlight(val);
  syncHlScroll();
}

function initHighlight() {
  if (!urlInput) return;

  const style = document.createElement('style');
  style.textContent = `
    #url-highlight {
      position:absolute;inset:0;display:flex;align-items:center;
      padding:0 28px;font-size:0.875rem;pointer-events:none;
      white-space:pre;overflow:hidden;box-sizing:border-box;
      font-family:inherit;letter-spacing:inherit;z-index:0;
      height:28px;line-height:28px;
    }
    #url-highlight .hl-dim { color:#6b6a8a; }
    #url-highlight .hl-host { color:#e2e1f0;font-weight:500; }
    #urlbar {
      position:relative;z-index:1;background:transparent!important;
      color:transparent!important;caret-color:#fff!important;
    }
    #urlbar::selection { background:rgba(92,89,165,0.45);color:transparent; }
  `;
  shadow.appendChild(style);

  hlLayer = shadow.querySelector('#url-highlight') as HTMLDivElement | null;
  if (!hlLayer) {
    hlLayer = document.createElement('div');
    hlLayer.id = 'url-highlight';
    hlLayer.setAttribute('aria-hidden', 'true');
    urlInput.parentElement?.insertBefore(hlLayer, urlInput);
  }

  urlInput.addEventListener('focus', () => {
    isTyping = true;
  });
  urlInput.addEventListener('blur', () => {
    isTyping = false;
    lastHighlightVal = '';
    renderHighlight(urlInput!.value);
    syncHlScroll();
  });
  urlInput.addEventListener('input', () => {
    lastHighlightVal = '';
    renderHighlight(urlInput!.value);
    syncHlScroll();
  });
  urlInput.addEventListener('scroll', syncHlScroll);
  renderHighlight(urlInput.value);
}

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

async function ensureTransport(): Promise<void> {
  if (transportReady) return;
  if (transportInitPromise) return transportInitPromise;
  transportInitPromise = (async () => {
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
  })();
  return transportInitPromise;
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

const TAB_TITLE_MAX = 12;
const truncate = (s: string, len = TAB_TITLE_MAX) => (s.length > len ? s.slice(0, len) + '…' : s);

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

const normalizePath = (p: string) => p.replace(/\/+$/, '');

function getDisplayUrl(iframeHref: string): string {
  try {
    const url = new URL(iframeHref, location.origin);
    const pathname = normalizePath(url.pathname);
    const fullPath = pathname + url.search + url.hash;
    for (const [key, val] of Object.entries(internalRoutes)) {
      if (val === pathname) return key;
    }
    return decodeProxyUrl(fullPath) || '';
  } catch {
    return '';
  }
}

function resolveTitle(doc: Document | null, iframeHref: string): string {
  let title = '';
  try {
    title = decodeURIComponent(doc?.title || '').trim();
  } catch {
    title = (doc?.title || '').trim();
  }
  if (title) return title;

  const decoded = getDisplayUrl(iframeHref);
  try {
    const url = new URL(iframeHref, location.origin);
    if (normalizePath(url.pathname) !== '/new' && decoded) return new URL(decoded).hostname;
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

function updateUrlBar(tab: Tab): void {
  if (tab.id !== activeId || !urlInput) return;
  try {
    const doc = tab.iframe.contentDocument;
    if (!doc) return;
    const val = getDisplayUrl(doc.location.href || '');
    if (!isTyping) setUrlDisplay(val);
    else urlInput.value = val;
  } catch {}
}

const isBlankTarget = (el: HTMLElement) => {
  if (el.tagName !== 'A' && el.tagName !== 'AREA') return false;
  const t = (el as HTMLAnchorElement).target;
  return t === '_blank' || t === '_new';
};

function interceptLink(el: HTMLElement): void {
  if (!isBlankTarget(el) || (el as any).__lr) return;
  (el as any).__lr = true;
  el.addEventListener('click', e => {
    if (!isBlankTarget(el)) return;
    e.preventDefault();
    const href = (el as HTMLAnchorElement).href;
    if (href) encodeProxyUrl(href).then(u => openTab(u));
  });
}

const linkSelector =
  'a[target="_blank"], a[target="_new"], area[target="_blank"], area[target="_new"]';

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
  left.style.cssText =
    'height:100%;display:flex;align-items:center;min-width:0;overflow:hidden;flex:1;gap:8px;';

  const icon = document.createElement('img');
  icon.className = 'tab-favicon';
  icon.src = tab.favicon;
  icon.style.cssText =
    'width:15px;height:15px;object-fit:contain;display:block;flex-shrink:0;' +
    'image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges;';

  const title = document.createElement('span');
  title.className = 'tab-title';
  title.style.cssText =
    'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
    'line-height:1.4;font-size:12.5px;display:block;min-width:0;flex:1;';
  title.textContent = truncate(tab.title);

  const closeBtn = document.createElement('button');

closeBtn.style.cssText = `
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #9ca3af;
  transition: all 0.15s ease;
  margin-left: 4px;
  outline: none;
`;

closeBtn.innerHTML = `
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
`;
  closeBtn.onmouseenter = () => {
    closeBtn.style.background = 'rgba(255,255,255,0.15)';
    closeBtn.style.color = '#e5e7eb';
  };
  closeBtn.onmouseleave = () => {
    closeBtn.style.background = 'none';
    closeBtn.style.color = '#9ca3af';
  };
  closeBtn.innerHTML =
    '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;flex-shrink:0;">' +
    '<path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  closeBtn.onclick = (e: MouseEvent) => {
    e.stopPropagation();
    closeTab(tab.id);
  };

  left.append(icon, title);
  el.append(left, closeBtn);
  el.onclick = () => switchTab(tab.id);
  tab.el = el;
  return el;
}

function updateActive(): void {
  for (const tab of tabs) {
    if (tab.el) tab.el.className = tab.id === activeId ? tabActiveClass : tabInactiveClass;
  }
}

function renderTabs(): void {
  if (!tabBar) return;
  const keep = new Set<Node>();
  for (const tab of tabs) {
    if (!tab.el) createTabEl(tab);
    keep.add(tab.el!);
    tabBar.appendChild(tab.el!);
  }
  for (let i = tabBar.children.length - 1; i >= 0; i--) {
    const child = tabBar.children[i];
    if (!keep.has(child)) child.remove();
  }
}

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
      const pathname = normalizePath(new URL(doc.location.href, location.origin).pathname);
      if (Object.values(internalRoutes).includes(pathname) || pathname === '/new') return;

      win.open = (openUrl?: string | URL) => {
        if (openUrl) encodeProxyUrl(openUrl.toString()).then(u => openTab(u));
        return null;
      };

      doc.querySelectorAll<HTMLElement>(linkSelector).forEach(interceptLink);

      new MutationObserver(muts => {
        for (const m of muts) {
          if (m.type === 'childList') {
            for (const node of m.addedNodes) {
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

  const frame = createFrame(id, src);
  tab.iframe = frame;
  frameContainer.appendChild(frame);

  createTabEl(tab);
  if (tabBar) tabBar.appendChild(tab.el!);

  switchTab(id);
  if (!src || src === 'new') setUrlDisplay('lunar://new');

  frame.addEventListener(
    'load',
    () => {
      const t = tabs.find(t => t.id === id);
      if (!t) return;
      t.isReady = true;
      syncTab(t);
      pollTitle(t);
      updateUrlBar(t);
      resetLoader();
    },
    { once: false }
  );
}

function switchTab(id: number): void {
  if (urlWatcher) {
    clearInterval(urlWatcher);
    urlWatcher = null;
  }

  activeId = id;
  prevHref = '';

  for (const tab of tabs) {
    tab.iframe.classList.toggle('hidden', tab.id !== id);
  }
  updateActive();

  const tab = tabs.find(t => t.id === id);
  if (!tab) return;

  if (tab.isReady) {
    syncTab(tab);
    updateUrlBar(tab);
  }

  urlWatcher = setInterval(() => {
    if (activeId !== id) return;
    try {
      if (!tab.iframe) return;
      const href = tab.iframe.contentWindow?.location.href;
      if (!href || href === prevHref) return;
      prevHref = href;
      const disp = getDisplayUrl(href);
      if (!isTyping) setUrlDisplay(disp);
      else if (urlInput) urlInput.value = disp;
      syncTab(tab);
      if (onUrlChange) onUrlChange(href);
    } catch {}
  }, 250);
}

function closeTab(id: number): void {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;

  if (tabs.length === 1) {
    openTab();
  }

  const [removed] = tabs.splice(idx, 1);
  if (removed.titleTimer) clearInterval(removed.titleTimer);
  removed.iframe.remove();
  removed.el?.remove();

  if (activeId === id && tabs.length) {
    switchTab(tabs[Math.max(0, idx - 1)].id);
  }
  renderTabs();
}

ready.then(() => {
  tabBar = shadow.querySelector('#tcontainer') as HTMLDivElement | null;
  frameContainer = shadow.querySelector('#fcontainer') as HTMLDivElement | null;
  urlInput = shadow.querySelector('#urlbar') as HTMLInputElement | null;
  loadingBar = shadow.querySelector('#loading-bar') as HTMLDivElement | null;

  initHighlight();

  shadow.querySelector('#add')?.addEventListener('click', () => openTab());

  urlInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') showLoader();
  });

  ensureTransport().catch(() => {});

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
