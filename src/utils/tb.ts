import ConfigAPI from './config';
import { scramjetWrapper } from './pro';
import { vWrapper } from './pro';
import * as baremux from "@mercuryworkshop/bare-mux"

type Tab = {
  id: number;
  title: string;
  favicon: string;
  iframe: HTMLIFrameElement;
  el?: HTMLDivElement;
};

const links: Record<string, string> = {
  'lunar://settings': '/st',
  'lunar://new': '/new',
  'lunar://games': '/math',
  'lunar://apps': '/sci',
};

const moonIcon = '/a/moon.svg';
const FAVICON_API =
  'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64';
const iconApi = FAVICON_API + '&url=';
const connection = new baremux.BareMuxConnection("/bm/worker.js");
const client = new baremux.BareClient();

let tabs: Tab[] = [];
let current: number | null = null;
let dragging: number | null = null;
let nextId = 1;
let urlTimer: ReturnType<typeof setInterval> | null = null;

const bar = document.getElementById('tcontainer') as HTMLDivElement;
const frames = document.getElementById('fcontainer') as HTMLDivElement;

function getId(): number {
  return nextId++;
}

function getDecoded(path: string): string {
  const scPre = scramjetWrapper.getConfig().prefix;
  const uPre = vWrapper.getConfig().prefix;

  if (path.startsWith(scPre)) {
    return decodeURIComponent(
      scramjetWrapper.getConfig().codec.decode(path.slice(scPre.length)) || ''
    );
  } else if (path.startsWith(uPre)) {
    return vWrapper.getConfig().decodeUrl(path.slice(uPre.length));
  }

  return '';
}

async function getEncoded(url: string): Promise<string> {
  const backend = await ConfigAPI.get('backend');
  
  if (backend === 'sc') {
    const cfg = scramjetWrapper.getConfig();
    return cfg.prefix + cfg.codec.encode(url);
  } else if (backend === 'u') {
    const cfg = vWrapper.getConfig();
    return cfg.prefix + cfg.encodeUrl(url);
  }
  
  return url;
}

function makeFrame(id: number, url?: string): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.id = `frame-${id}`;
  frame.src = url ?? 'new';
  frame.className = 'w-full z-0 h-full hidden';
  frame.setAttribute(
    'sandbox',
    'allow-scripts allow-popups allow-modals allow-top-navigation allow-pointer-lock allow-same-origin allow-forms'
  );

  frame.addEventListener('load', async () => {
    try {
      const win = frame.contentWindow;
      if (!win) return;

      const origOpen = win.open;
      win.open = function (
        url?: string | URL,
        target?: string,
        features?: string
      ): WindowProxy | null {
        console.log('Intercepted window.open:', url, target, features);
        if (url) {
          const str = url.toString();
          getEncoded(str).then(encoded => open(encoded)).catch(console.error);
          return null;
        }
        return origOpen.call(this, url, target, features);
      };
    } catch {}
  });

  return frame;
}

function cut(text: string, max = 20): string {
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

async function getIcon(url: string): Promise<string> {
  try {
    if (await connection.getTransport() !== '/lc/index.mjs') {
      await connection.setTransport('/lc/index.mjs', [{ wisp: await ConfigAPI.get('wispUrl') }]);
    }
    const res = await client.fetch(iconApi + encodeURIComponent(url));
    if (!res.ok) throw new Error('fail');
    const blob = await res.blob();
    const b64 = await toBase64(blob);
    if (b64) return b64;
  } catch {}
  return moonIcon;
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function loaded(tab: Tab): Promise<void> {
  try {
    const doc = tab.iframe.contentDocument;
    if (!doc) return;

    
    const newTitle = doc.title?.trim() || 'New Tab';
    if (tab.title !== newTitle) {
      tab.title = newTitle;
      refresh(tab, 'title');
    }

    const src = tab.iframe.src;
    const url = new URL(src, window.location.origin);
    const decoded = getDecoded(url.pathname);

    if (!decoded) {
      if (tab.favicon !== moonIcon) {
        tab.favicon = moonIcon;
        refresh(tab, 'icon');
      }
      return;
    }

    const icon = await getIcon(decoded);
    if (tab.favicon !== icon) {
      tab.favicon = icon;
      refresh(tab, 'icon');
    }
    
  } catch {
    if (tab.favicon !== moonIcon) {
      tab.favicon = moonIcon;
      refresh(tab, 'icon');
    }
  }
}

function refresh(tab: Tab, what: 'title' | 'icon') {
  if (!tab.el) return;

  if (what === 'title') {
    const span = tab.el.querySelector('.tab-title') as HTMLSpanElement;
    if (span) {
      span.textContent = cut(tab.title);
    }
  }

  if (what === 'icon') {
    const img = tab.el.querySelector('.tab-favicon') as HTMLImageElement;
    if (img && img.src !== tab.favicon) {
      img.src = tab.favicon;
    }
  }
}

function makeTab(tab: Tab): HTMLDivElement {
  const el = document.createElement('div');
  const isActive = tab.id === current;
  
  el.className = `
    tab flex items-center justify-between h-10 min-w-[220px] px-3 py-2 rounded-t-2xl cursor-pointer select-none
    transition-all duration-200 shadow-sm relative z-10
    ${isActive ? 'bg-[#34324d] shadow-[0_0_8px_#5c59a5] border-t-2 border-[#5c59a5]' : 'bg-[#2a283e] hover:bg-[#323048]'}
  `;
  el.draggable = true;
  el.dataset.id = tab.id.toString();


  const left = document.createElement('div');
  left.className = 'flex items-center gap-2 overflow-hidden h-full';

  const icon = document.createElement('img');
  icon.alt = 'favicon';
  icon.src = tab.favicon;
  icon.className = 'tab-favicon w-4 h-4 min-w-4 min-h-4 max-w-4 max-h-4 rounded object-contain block box-border m-0 p-0';

  const title = document.createElement('span');
  title.textContent = cut(tab.title);
  title.className = 'tab-title text-sm font-medium truncate align-middle';

  left.append(icon, title);

  const close = document.createElement('button');
  close.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 stroke-[2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M18 6L6 18M6 6l12 12" />
    </svg>
  `;
  close.className = `
    w-6 h-6 flex items-center justify-center
    text-gray-400 hover:text-white hover:bg-[#5a567a]
    rounded-full transition duration-150 ml-2 flex-shrink-0
  `;
  close.onclick = e => {
    e.stopPropagation();
    kill(tab.id);
  };

  el.append(left, close);
  el.addEventListener('click', () => swap(tab.id));
  el.addEventListener('touchstart', () => swap(tab.id));
  
  el.ondragstart = e => {
    dragging = tab.id;
    el.classList.add('opacity-50');
    e.dataTransfer?.setData('text/plain', tab.id.toString());
  };
  
  el.ondragover = e => e.preventDefault();
  
  el.ondrop = e => {
    e.preventDefault();
    if (dragging === null || dragging === tab.id) return;
    
    const dragIdx = tabs.findIndex(t => t.id === dragging);
    const targetIdx = tabs.findIndex(t => t.id === tab.id);
    
    if (dragIdx !== -1 && targetIdx !== -1) {
      const [moved] = tabs.splice(dragIdx, 1);
      tabs.splice(targetIdx, 0, moved);
      draw();
    }
  };
  
  el.ondragend = () => {
    dragging = null;
    draw();
  };

  tab.el = el;
  return el;
}

function highlight() {
  tabs.forEach(tab => {
    if (!tab.el) return;
    
    const isActive = tab.id === current;
    
    tab.el.className = `
      tab flex items-center justify-between h-10 min-w-[220px] px-3 py-2 rounded-t-2xl cursor-pointer select-none
      transition-all duration-200 shadow-sm relative z-10
      ${isActive ? 'bg-[#34324d] shadow-[0_0_8px_#5c59a5] border-t-2 border-[#5c59a5]' : 'bg-[#2a283e] hover:bg-[#323048]'}
    `;
  });
}

function kill(id: number): void {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  
  const tab = tabs[idx];
  
  tab.iframe.onload = null;
  tab.iframe.onerror = null;
  tab.iframe.remove();
  
  tabs.splice(idx, 1);
  
  if (current === id && urlTimer !== null) {
    clearInterval(urlTimer);
    urlTimer = null;
  }
  
  if (!tabs.length) {
    open();
  } else {
    swap(tabs[Math.max(0, idx - 1)]?.id ?? tabs[0].id);
  }
  
  draw();
}

function draw(): void {
  bar.innerHTML = '';
  tabs.forEach(tab => {
    const el = makeTab(tab);
    bar.appendChild(el);
  });
}

function open(url?: string): void {
  const id = getId();
  const frame = makeFrame(id, url);
  frames.appendChild(frame);
  
  const tab: Tab = { 
    id, 
    title: 'New Tab', 
    favicon: moonIcon, 
    iframe: frame 
  };
  
  tabs.push(tab);
  draw();
  swap(id);
  frame.onload = () => loaded(tab);
}

function swap(id: number) {
  if (urlTimer !== null) {
    clearInterval(urlTimer);
    urlTimer = null;
  }

  current = id;

  tabs.forEach(tab => {
    tab.iframe.classList.toggle('hidden', tab.id !== id);
  });

  highlight();

  const tab = tabs.find(t => t.id === id);
  if (tab && tab.el) {
    refresh(tab, 'title');
    refresh(tab, 'icon');
  }

  const input = document.getElementById('urlbar') as HTMLInputElement | null;
  if (input && tab) {
    let src = tab.iframe.src;
    try {
      const url = new URL(src, window.location.origin);
      const path = url.pathname;
      const quick = Object.entries(links).find(([, p]) => p === path);
      if (quick) {
        input.value = quick[0];
      } else if (path.startsWith(scramjetWrapper.getConfig().prefix)) {
        const decoded = scramjetWrapper.getConfig().codec.decode(path.slice(scramjetWrapper.getConfig().prefix.length)) ?? '';
        input.value = decoded;
      } else if (path.startsWith(vWrapper.getConfig().prefix)) {
        const decoded = vWrapper.getConfig().decodeUrl(path.slice(vWrapper.getConfig().prefix.length)) ?? '';
        input.value = decoded;
      } else {
        input.value = '';
      }
    } catch {
      input.value = '';
    }
  }

  document.dispatchEvent(new CustomEvent('tab-switch', { detail: { tabId: id } }));

  let last = '';
  const update = () => {
    const frame = document.getElementById(`frame-${id}`) as HTMLIFrameElement;
    try {
      const href = frame?.contentWindow?.location.href;
      if (!href || href === last) return;
      last = href;
      const path = new URL(href, window.location.origin).pathname;
      const quick = Object.entries(links).find(([, p]) => p === path);
      if (input) {
        if (quick) {
          input.value = quick[0];
        } else if (path.startsWith(scramjetWrapper.getConfig().prefix)) {
          const decoded = scramjetWrapper.getConfig().codec.decode(path.slice(scramjetWrapper.getConfig().prefix.length)) ?? '';
          input.value = decoded;
        } else if (path.startsWith(vWrapper.getConfig().prefix)) {
          const decoded = vWrapper.getConfig().decodeUrl(path.slice(vWrapper.getConfig().prefix.length)) ?? '';
          input.value = decoded;
        } else {
          input.value = '';
        }
      }
    } catch {}
  };
  urlTimer = setInterval(update, 20);
  update();
}

document.addEventListener('DOMContentLoaded', () => {
  const add = document.getElementById('add') as HTMLButtonElement | null;
  add?.addEventListener('click', () => open());
  open();

  const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
  const loader = document.getElementById('loading-bar') as HTMLDivElement | null;
  let loadTimeout: ReturnType<typeof setTimeout> | null = null;
  let loading = false;

  function showLoad() {
    if (!loader || loading) return;
    loading = true;
    loader.style.display = 'block';
    loader.style.opacity = '1';
    loader.style.width = '0%';
    loader.style.transition = 'none';
    setTimeout(() => {
      if (!loading) return;
      loader.style.transition = 'width 0.5s cubic-bezier(.4,0,.2,1)';
      loader.style.width = '80%';
    }, 10);
    loadTimeout = setTimeout(() => {
      if (loading && loader) {
        loader.style.transition = 'width 0.3s cubic-bezier(.4,0,.2,1)';
        loader.style.width = '90%';
      }
    }, 1200);
  }

  function doneLoad() {
    if (!loader || !loading) return;
    loader.style.transition = 'width 0.2s cubic-bezier(.4,0,.2,1)';
    loader.style.width = '100%';
    setTimeout(() => {
      if (!loader) return;
      loader.style.opacity = '0';
      loader.style.display = 'none';
      loader.style.width = '0%';
      loading = false;
    }, 180);
  }

  function resetLoad() {
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      loadTimeout = null;
    }
    doneLoad();
  }

  if (urlbar) {
    urlbar.addEventListener('keydown', e => {
      if (e.key === 'Enter') showLoad();
    });
  }

  const origOpen = open;
  (window as any).openTab = function (url?: string) {
    showLoad();
    origOpen(url);
    const tab = tabs[tabs.length - 1];
    if (!tab) return;
  
    tab.iframe.addEventListener('load', resetLoad, { once: true });
    tab.iframe.addEventListener('error', resetLoad, { once: true });
  };

  tabs.forEach(tab => {
    tab.iframe.addEventListener('load', resetLoad);
    tab.iframe.addEventListener('error', resetLoad);
  });

  document.addEventListener('tab-switch', resetLoad);

  setInterval(() => {
    if (loading) {
      const tab = tabs.find(t => t.id === current);
      if (tab?.iframe?.contentDocument?.readyState === 'complete') {
        resetLoad();
      }
    }
  }, 500);
});

type EngineKey = 'duckduckgo' | 'google' | 'bing' | 'brave';
type Engine = { name: string; icon: string; url: string };

function setupSearch() {
  function moveBar() {
    const input = document.getElementById('urlbar') as HTMLInputElement | null;
    const loader = document.getElementById('loading-bar') as HTMLDivElement | null;
    if (input && loader) {
      const rect = input.getBoundingClientRect();
      loader.style.top = `${rect.bottom + window.scrollY}px`;
    }
  }
  
  window.addEventListener('DOMContentLoaded', moveBar);
  window.addEventListener('resize', moveBar);
  window.addEventListener('scroll', moveBar);

  const engines: Record<EngineKey, Engine> = {
    duckduckgo: {
      name: 'DuckDuckGo',
      icon: '/a/images/engines/ddg.ico',
      url: 'https://duckduckgo.com/?q='
    },
    google: {
      name: 'Google',
      icon: '/a/images/co/go.ico',
      url: 'https://www.google.com/search?q='
    },
    bing: {
      name: 'Bing',
      icon: '/a/images/engines/bi.ico',
      url: 'https://www.bing.com/search?q='
    },
    brave: {
      name: 'Brave Search',
      icon: '/a/images/engines/br.jpeg',
      url: 'https://search.brave.com/search?q='
    },
  };

  let engine: EngineKey = 'duckduckgo';

  (async () => {
    try {
      const saved = await ConfigAPI.get('engine');
      if (saved && typeof saved === 'string' && saved in engines) {
        engine = saved as EngineKey;
        const icon = document.getElementById('search-engine-icon') as HTMLImageElement | null;
        if (icon) {
          icon.src = engines[engine].icon;
          icon.alt = engines[engine].name;
        }
      }
    } catch (err) {
      console.error('Error loading engine config:', err);
    }
  })();

  const btn = document.getElementById('search-engine-btn') as HTMLButtonElement | null;
  const icon = document.getElementById('search-engine-icon') as HTMLImageElement | null;
  const dropdown = document.getElementById('search-engine-dropdown') as HTMLDivElement | null;
  const chevron = btn?.querySelector('[data-lucide="chevron-down"]') as HTMLElement | null;

  btn?.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    const hidden = dropdown?.classList.contains('hidden');
    if (hidden) {
      dropdown?.classList.remove('hidden');
      if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
      dropdown?.classList.add('hidden');
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
  });

  document.addEventListener('click', (e: MouseEvent) => {
    if (!btn?.contains(e.target as Node) && !dropdown?.contains(e.target as Node)) {
      dropdown?.classList.add('hidden');
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
  });

  document.querySelectorAll<HTMLButtonElement>('.search-engine-option').forEach(opt => {
    opt.addEventListener('click', async () => {
      const val = opt.dataset.engine as EngineKey | undefined;
      if (!val || !(val in engines)) return;
      
      engine = val;
      if (icon) {
        icon.src = engines[val].icon;
        icon.alt = engines[val].name;
        dropdown?.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        icon.style.transform = 'scale(1.2)';
        setTimeout(() => {
          if (icon) icon.style.transform = 'scale(1)';
        }, 200);
      }
      
      try {
        await ConfigAPI.set('engine', engines[val].url);
      } catch (err) {
        console.error('Error saving engine config:', err);
      }
    });
  });
}

setupSearch();

export const TabManager = {
  get activeTabId() {
    return current;
  },
  set activeTabId(id: number | null) {
    if (id !== null) swap(id);
  },
  openTab: open,
};