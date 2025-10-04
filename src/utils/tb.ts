interface Tab {
  id: number;
  title: string;
  favicon: string;
  iframe: HTMLIFrameElement;
}

const defaultFavicon = '/a/moon.svg';
const iconURL = '/api/icon/?url=';

let tabs: Tab[] = [];
let activeTabId: number | null = null;
let draggedTabId: number | null = null;
let tabCounter = 1;
let updateInterval: ReturnType<typeof setInterval> | null = null;

const tabContainer = document.getElementById('tcontainer') as HTMLDivElement;
const frameContainer = document.getElementById('fcontainer') as HTMLDivElement;

function getNextId(): number {
  return tabCounter++;
}

function createFrame(id: number, url?: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.id = `frame-${id}`;
  iframe.src = url ?? 'new';
  iframe.className = 'w-full h-full hidden';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
  return iframe;
}

function cutTitle(title: string, limit = 16): string {
  return title.length > limit ? `${title.slice(0, limit)}...` : title;
}

function addTab(url?: string): void {
  const id = getNextId();
  const iframe = createFrame(id, url);
  frameContainer.appendChild(iframe);

  const tab: Tab = {
    id,
    title: 'New Tab',
    favicon: defaultFavicon,
    iframe,
  };

  tabs.push(tab);
  renderTabs();
  setActiveTab(id);

  iframe.onload = () => handleLoad(tab);

  const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
  if (urlbar) urlbar.value = 'lunar://new';
}

function handleLoad(tab: Tab): void {
  try {
    const doc = tab.iframe.contentDocument;
    if (!doc) return;

    tab.title = doc.title?.trim() || 'New Tab';

    const url = new URL(tab.iframe.src);
    if (url.origin === location.origin) throw new Error('Same origin');

    fetch(iconURL + encodeURIComponent(url.origin))
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          tab.favicon = reader.result as string || defaultFavicon;
          renderTabs();
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        tab.favicon = defaultFavicon;
        renderTabs();
      });
  } catch {
    tab.favicon = defaultFavicon;
    renderTabs();
  }
}

function setActiveTab(id: number): void {
  activeTabId = id;

  tabs.forEach(tab => {
    tab.iframe.classList.toggle('hidden', tab.id !== id);
  });

  const input = document.getElementById('urlbar') as HTMLInputElement | null;
  if (!input) return;

  if (updateInterval !== null) {
    clearInterval(updateInterval);
    updateInterval = null;
  }

  const nativePaths: Record<string, string> = {
    'lunar://settings': '/st',
    'lunar://new': '/new',
    'lunar://games': '/math',
  };

  let previousUrl = '';

  const updateUrl = () => {
    const frame = document.getElementById(`frame-${id}`) as HTMLIFrameElement;
    const currentSrc = frame.contentWindow?.location.href;
    if (!currentSrc || currentSrc === previousUrl) return;
    previousUrl = currentSrc;

    try {
      const framePath = new URL(currentSrc, window.location.origin).pathname;
      const nativeEntry = Object.entries(nativePaths).find(([, path]) => path === framePath);
      input.value = nativeEntry ? nativeEntry[0] : decodeURIComponent(currentSrc.split('/sj/')[1] || '');
    } catch { }
  };

  updateUrl();
  updateInterval = setInterval(updateUrl, 200);

  updateActive();
}

function updateActive(): void {
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

function removeTab(id: number): void {
  const index = tabs.findIndex(tab => tab.id === id);
  if (index === -1) return;

  tabs[index].iframe.remove();
  tabs.splice(index, 1);

  if (!tabs.length) addTab();
  else setActiveTab(tabs[Math.max(0, index - 1)]?.id ?? tabs[0].id);

  renderTabs();
}

function renderTabs(): void {
  tabContainer.innerHTML = '';

  tabs.forEach(tab => {
    const tabElement = document.createElement('div');
    tabElement.className = `
      tab flex items-center h-10 min-w-[220px] px-3 rounded-t-2xl cursor-pointer select-none
      transition-all duration-200 shadow
    `;
    tabElement.draggable = true;
    tabElement.dataset.id = tab.id.toString();

    const favicon = document.createElement('img');
    favicon.src = tab.favicon;
    favicon.alt = 'favicon';
    favicon.className = 'w-4 h-4 rounded-full mr-2 flex-shrink-0';

    const title = document.createElement('span');
    title.textContent = cutTitle(tab.title, 20);
    title.className = 'text-sm font-medium truncate grow';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.className = `
      ml-2 flex-shrink-0 w-6 h-6 flex items-center justify-center
      text-gray-400 hover:text-white hover:bg-[#5a567a] rounded-full
      transition duration-150
    `;
    closeBtn.onclick = e => {
      e.stopPropagation();
      removeTab(tab.id);
    };

    tabElement.append(favicon, title, closeBtn);

    tabElement.addEventListener('click', () => setActiveTab(tab.id));
    tabElement.addEventListener('touchstart', () => setActiveTab(tab.id));

    tabElement.ondragstart = e => {
      draggedTabId = tab.id;
      tabElement.classList.add('opacity-50');
      e.dataTransfer?.setData('text/plain', tab.id.toString());
    };
    tabElement.ondragover = e => e.preventDefault();
    tabElement.ondrop = e => {
      e.preventDefault();
      if (draggedTabId === null || draggedTabId === tab.id) return;

      const draggedIndex = tabs.findIndex(t => t.id === draggedTabId);
      const targetIndex = tabs.findIndex(t => t.id === tab.id);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [moved] = tabs.splice(draggedIndex, 1);
        tabs.splice(targetIndex, 0, moved);
        renderTabs();
      }
    };
    tabElement.ondragend = () => {
      draggedTabId = null;
      renderTabs();
    };

    tabContainer.appendChild(tabElement);
  });

  updateActive();
}

document.addEventListener('DOMContentLoaded', () => {
  const addBtn = document.getElementById('add') as HTMLButtonElement | null;
  addBtn?.addEventListener('click', () => addTab());
  addTab();
});

export const TabManager = {
  get activeTabId() {
    return activeTabId;
  },
  set activeTabId(id: number | null) {
    if (id !== null) setActiveTab(id);
  },
  addTab,
};
