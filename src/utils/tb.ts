import ConfigAPI from './config';
import { scramjetWrapper } from './pro';
import { vWrapper } from './pro';

type Tab = {
  id: number;
  title: string;
  favicon: string;
  iframe: HTMLIFrameElement;
};

const quickLinks: Record<string, string> = {
  'lunar://settings': '/st',
  'lunar://new': '/new',
  'lunar://games': '/math',
  'lunar://apps': '/sci',
  'lunar://error': '/404'
};

const moonIcon = '/a/moon.svg';
const iconApi = '/api/icon/?url=';

let allTabs: Tab[] = [];
let activeTabId: number | null = null;
let draggingTab: number | null = null;
let nextTabId = 1;
let urlUpdateTimer: ReturnType<typeof setInterval> | null = null;

const tabBar = document.getElementById('tcontainer') as HTMLDivElement;
const frameArea = document.getElementById('fcontainer') as HTMLDivElement;

function getTabId(): number {
  return nextTabId++;
}

function makeFrame(id: number, url?: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.id = `frame-${id}`;
  iframe.src = url ?? 'new';
  iframe.className = 'w-full z-0 h-full hidden';
  iframe.setAttribute(
    'sandbox',
    'allow-scripts allow-popups allow-modals allow-top-navigation allow-pointer-lock allow-same-origin allow-forms',
  );

  iframe.addEventListener('load', async () => {
    const backend = await ConfigAPI.get('backend');
    try {
      const iframeWindow = iframe.contentWindow;
      if (iframeWindow) {
        const originalOpen = iframeWindow.open;
        iframeWindow.open = function (
          url?: string | URL,
          target?: string,
          features?: string,
        ): WindowProxy | null {
          if (url && backend == 'sc') {
            const newUrl =
              scramjetWrapper.getConfig().prefix +
              scramjetWrapper.getConfig().codec.encode(url.toString());
            openTab(newUrl);
            return null;
          } else if (url && backend == 'u') {
            let config = vWrapper.getConfig();
            const newUrl = config.prefix + config.encodeUrl(url.toString());
            openTab(newUrl);
            return null;
          }
          return originalOpen.call(this, url, target, features);
        };
      }
    } catch {}
  });

  return iframe;
}

function shortTitle(title: string, limit = 16): string {
  return title.length > limit ? `${title.slice(0, limit)}...` : title;
}

function showError(tab: Tab): void {
  tab.title = 'lunar://error';
  tab.favicon = moonIcon;
  tab.iframe.src = '/404';
  drawTabs();
  const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
  if (urlbar) urlbar.value = 'lunar://error';
}

function openTab(url?: string): void {
  const id = getTabId();
  const iframe = makeFrame(id, url);
  frameArea.appendChild(iframe);
  const tab: Tab = { id, title: 'New Tab', favicon: moonIcon, iframe };
  allTabs.push(tab);
  drawTabs();
  switchTab(id);
  iframe.onload = () => onTabLoad(tab);
  const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
  if (urlbar) urlbar.value = url ?? 'lunar://new';
}

async function onTabLoad(tab: Tab): Promise<void> {
  try {
    const doc = tab.iframe.contentDocument;
    if (!doc) {
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  
    tab.title = (doc.title?.trim() ?? 'New Tab');

    const src = tab.iframe.src;
    const url = new URL(src, window.location.origin);
    let decodedPath = '';

    if (url.pathname.startsWith(scramjetWrapper.getConfig().prefix)) {
        decodedPath = decodeURIComponent(
        scramjetWrapper.getConfig().codec.decode(url.pathname.slice(scramjetWrapper.getConfig().prefix.length) || '') || ''
      );
    } else if (url.pathname.startsWith(vWrapper.getConfig().prefix)) {
      decodedPath = vWrapper.getConfig().decodeUrl(url.pathname.slice(vWrapper.getConfig().prefix.length));
    }

    if (!decodedPath) {
      tab.favicon = moonIcon;
      drawTabs();
      return;
    }

    const response = await fetch(iconApi + decodedPath);
    if (!response.ok) throw new Error('Failed to fetch favicon');

    const blob = await response.blob();

    const favicon = await blobToBase64(blob);
    tab.favicon = favicon || moonIcon;
  } catch (e) {
    console.error('Failed to fetch favicon:', e);
    tab.favicon = moonIcon;
  } finally {
    drawTabs();
  }
}


function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function setActiveTab(id: number) {
  activeTabId = id;
  allTabs.forEach(tab => {
    tab.iframe.classList.toggle('hidden', tab.id !== id);
  });
  const input = document.getElementById('urlbar') as HTMLInputElement | null;
  if (!input) return;
  if (urlUpdateTimer !== null) {
    clearInterval(urlUpdateTimer);
    urlUpdateTimer = null;
  }
  let lastUrl = '';
  const updateUrl = () => {
    const frame = document.getElementById(`frame-${id}`) as HTMLIFrameElement;
    try {
      const currentSrc = frame.contentWindow?.location.href;
      if (!currentSrc || currentSrc === lastUrl) return;
      lastUrl = currentSrc;
      const framePath = new URL(currentSrc, window.location.origin).pathname;
      const quickEntry = Object.entries(quickLinks).find(([, path]) => path === framePath);
      if (quickEntry) {
        input.value = quickEntry[0];
      } else if (framePath.startsWith(scramjetWrapper.getConfig().prefix)) {
        input.value = scramjetWrapper
          .getConfig()
          .codec.decode(framePath.slice(scramjetWrapper.getConfig().prefix.length)) ?? '';
      } else if (framePath.startsWith(vWrapper.getConfig().prefix)) {
        input.value = vWrapper
          .getConfig()
          .decodeUrl(framePath.slice(vWrapper.getConfig().prefix.length)) ?? '';
      } else {
        input.value = '';
      }
    } catch {}
  };
  urlUpdateTimer = setInterval(updateUrl, 400);
  highlightTab();
}

function highlightTab(): void {
  document.querySelectorAll<HTMLElement>('.tab').forEach(el => {
    const id = parseInt(el.dataset.id || '', 10);
    const isActive = id === activeTabId;
    el.classList.toggle('bg-[#34324d]', isActive);
    el.classList.toggle('shadow-[0_0_8px_#5c59a5]', isActive);
    el.classList.toggle('border-t-2', isActive);
    el.classList.toggle('border-[#5c59a5]', isActive);
    el.classList.toggle('bg-[#2a283e]', !isActive);
    el.classList.toggle('hover:bg-[#323048]', !isActive);
  });
}

function closeTab(id: number): void {
  const index = allTabs.findIndex(tab => tab.id === id);
  if (index === -1) return;
  allTabs[index].iframe.remove();
  allTabs.splice(index, 1);
  if (!allTabs.length) openTab();
  else switchTab(allTabs[Math.max(0, index - 1)]?.id ?? allTabs[0].id);
  drawTabs();
}

function drawTabs(): void {
  tabBar.innerHTML = '';
  allTabs.forEach(tab => {
    const tabElement = document.createElement('div');
    tabElement.className = `
      tab flex items-center justify-between h-10 min-w-[220px] px-3 py-2 rounded-t-2xl cursor-pointer select-none
      transition-all duration-200 bg-[#2a283e]
      hover:bg-[#323048] shadow-sm relative z-10
    `;
    tabElement.draggable = true;
    tabElement.dataset.id = tab.id.toString();

    const left = document.createElement('div');
    left.className = 'flex items-center overflow-hidden gap-2';
    const favicon = document.createElement('img');
    favicon.src = tab.favicon;
    favicon.alt = 'favicon';
    favicon.className = 'w-4 h-4 rounded-full flex-shrink-0';
    const title = document.createElement('span');
    title.textContent = shortTitle(tab.title ?? '', 20);
    title.className = 'text-sm font-medium truncate';
    left.append(favicon, title);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 stroke-[2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M18 6L6 18M6 6l12 12" />
      </svg>
    `;
    closeBtn.className = `
      w-6 h-6 flex items-center justify-center
      text-gray-400 hover:text-white hover:bg-[#5a567a]
      rounded-full transition duration-150 ml-2 flex-shrink-0
    `;
    closeBtn.onclick = e => {
      e.stopPropagation();
      closeTab(tab.id);
    };

    tabElement.append(left, closeBtn);
    tabElement.addEventListener('click', () => switchTab(tab.id));
    tabElement.addEventListener('touchstart', () => switchTab(tab.id));
    tabElement.ondragstart = e => {
      draggingTab = tab.id;
      tabElement.classList.add('opacity-50');
      e.dataTransfer?.setData('text/plain', tab.id.toString());
    };
    tabElement.ondragover = e => e.preventDefault();
    tabElement.ondrop = e => {
      e.preventDefault();
      if (draggingTab === null || draggingTab === tab.id) return;
      const draggedIndex = allTabs.findIndex(t => t.id === draggingTab);
      const targetIndex = allTabs.findIndex(t => t.id === tab.id);
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [moved] = allTabs.splice(draggedIndex, 1);
        allTabs.splice(targetIndex, 0, moved);
        drawTabs();
      }
    };
    tabElement.ondragend = () => {
      draggingTab = null;
      drawTabs();
    };
    tabBar.appendChild(tabElement);
  });
  highlightTab();
}

document.addEventListener('DOMContentLoaded', () => {
  const addBtn = document.getElementById('add') as HTMLButtonElement | null;
  addBtn?.addEventListener('click', () => openTab());
  openTab();

  const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
  const loadingBar = document.getElementById('loading-bar') as HTMLDivElement | null;
  let loadingTimeout: ReturnType<typeof setTimeout> | null = null;

  function showBar() {
    if (!loadingBar) return;
    loadingBar.style.display = 'block';
    loadingBar.style.opacity = '1';
    loadingBar.style.width = '0%';
    loadingBar.style.transition = 'none';
    setTimeout(() => {
      loadingBar.style.transition = 'width 0.22s cubic-bezier(.4,0,.2,1)';
      loadingBar.style.width = '80%';
    }, 10);
  }

  function hideBar() {
    if (!loadingBar) return;
    loadingBar.style.transition = 'width 0.13s cubic-bezier(.4,0,.2,1)';
    loadingBar.style.width = '100%';
    setTimeout(() => {
      loadingBar.style.opacity = '0';
      loadingBar.style.display = 'none';
      loadingBar.style.width = '0%';
    }, 140);
  }

  if (urlbar) {
    urlbar.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        showBar();
        if (loadingTimeout) clearTimeout(loadingTimeout);
        loadingTimeout = setTimeout(hideBar, 10000);
      }
    });
  }

  const origOpenTab = openTab;
  (window as any).openTab = function (url?: string) {
    origOpenTab(url);
    const tab = allTabs[allTabs.length - 1];
    if (!tab) return;
    tab.iframe.addEventListener('load', () => {
      hideBar();
      if (loadingTimeout) clearTimeout(loadingTimeout);
    });
    tab.iframe.addEventListener('error', () => {
      hideBar();
      if (loadingTimeout) clearTimeout(loadingTimeout);
    });
  };

  allTabs.forEach(tab => {
    tab.iframe.addEventListener('load', () => {
      hideBar();
      if (loadingTimeout) clearTimeout(loadingTimeout);
    });
    tab.iframe.addEventListener('error', () => {
      hideBar();
      if (loadingTimeout) clearTimeout(loadingTimeout);
    });
  });
});

export const TabManager = {
  get activeTabId() {
    return activeTabId;
  },
  set activeTabId(id: number | null) {
    if (id !== null) switchTab(id);
  },
  openTab,
};
function switchTab(id: number) {
  activeTabId = id;
  allTabs.forEach(tab => {
    tab.iframe.classList.toggle('hidden', tab.id !== id);
  });
  const input = document.getElementById('urlbar') as HTMLInputElement | null;
  if (!input) return;
  if (urlUpdateTimer !== null) {
    clearInterval(urlUpdateTimer);
    urlUpdateTimer = null;
  }
  let lastUrl = '';
  const updateUrl = () => {
    const frame = document.getElementById(`frame-${id}`) as HTMLIFrameElement;
    try {
      const currentSrc = frame.contentWindow?.location.href;
      if (!currentSrc || currentSrc === lastUrl) return;
      lastUrl = currentSrc;
      const framePath = new URL(currentSrc, window.location.origin).pathname;
      const quickEntry = Object.entries(quickLinks).find(([, path]) => path === framePath);
      if (quickEntry) {
        input.value = quickEntry[0];
      } else if (framePath.startsWith(scramjetWrapper.getConfig().prefix)) {
        input.value = scramjetWrapper
          .getConfig()
          .codec.decode(framePath.slice(scramjetWrapper.getConfig().prefix.length)) ?? '';
      } else if (framePath.startsWith(vWrapper.getConfig().prefix)) {
        input.value = vWrapper
          .getConfig()
          .decodeUrl(framePath.slice(vWrapper.getConfig().prefix.length)) ?? '';
      } else {
        input.value = '';
      }
    } catch {}
  };
  urlUpdateTimer = setInterval(updateUrl, 400);
  highlightTab();
}
