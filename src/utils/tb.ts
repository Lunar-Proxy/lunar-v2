type Tab = {
  id: number;
  title: string;
  favicon: string;
  iframe: HTMLIFrameElement;
};

const nativePaths: Record<string, string> = {
  'lunar://settings': '/st',
  'lunar://new': '/new',
  'lunar://games': '/math',
  'lunar://apps': '/sci',
};
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
  iframe.className = 'w-full z-0 h-full hidden';
  iframe.setAttribute(
    'sandbox',
    'allow-scripts allow-top-navigation allow-pointer-lock allow-same-origin allow-forms',
  );
  return iframe;
}

function cutTitle(title: string, limit = 16): string {
  return title.length > limit ? `${title.slice(0, limit)}...` : title;
}

function addTab(url?: string): void {
  const id = getNextId();
  const iframe = createFrame(id, url);
  frameContainer.appendChild(iframe);
  const tab: Tab = { id, title: 'New Tab', favicon: defaultFavicon, iframe };
  tabs.push(tab);
  renderTabs();
  setActiveTab(id);
  iframe.onload = () => handleLoad(tab);
  const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
  if (urlbar) urlbar.value = 'lunar://new';
}

async function handleLoad(tab: Tab): Promise<void> {
  try {
    const doc = tab.iframe.contentDocument;
    if (!doc) return;

    tab.title = doc.title?.trim() || 'New Tab';

    const url = new URL(tab.iframe.src);
    const decodedPath = decodeURIComponent(url.pathname.slice("/sj/".length));

    const response = await fetch(iconURL + decodedPath);
    if (!response.ok) throw new Error('Failed to fetch favicon');

    const blob = await response.blob();
    const reader = new FileReader();

    reader.onloadend = () => {
      tab.favicon = (reader.result as string) || defaultFavicon;
      renderTabs();
    };

    reader.readAsDataURL(blob);
  } catch (e) {
    tab.favicon = defaultFavicon;
    renderTabs();
    console.error("Failed to fetch favicon:", e);
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
  let previousUrl = '';
  const updateUrl = () => {
    const frame = document.getElementById(`frame-${id}`) as HTMLIFrameElement;
    const currentSrc = frame.contentWindow?.location.href;
    if (!currentSrc || currentSrc === previousUrl) return;
    previousUrl = currentSrc;
    try {
      const framePath = new URL(currentSrc, window.location.origin).pathname;
      const nativeEntry = Object.entries(nativePaths).find(([, path]) => path === framePath);
      input.value = nativeEntry
        ? nativeEntry[0]
        : decodeURIComponent(currentSrc.split('/sj/')[1] || '');

    } catch {}
  };

  updateInterval = setInterval(updateUrl, 400);
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
      tab flex items-center justify-between h-10 min-w-[220px] px-3 rounded-t-2xl cursor-pointer select-none
      transition-all duration-200 bg-[#2a283e]
      hover:bg-[#323048] shadow-sm relative z-10
    `;
    tabElement.draggable = true;
    tabElement.dataset.id = tab.id.toString();

    const left = document.createElement('div');
    left.className = 'flex items-center overflow-hidden';
    const favicon = document.createElement('img');
    favicon.src = tab.favicon;
    favicon.alt = 'favicon';
    favicon.className = 'w-4 h-4 rounded-full mr-2 flex-shrink-0';
    const title = document.createElement('span');
    title.textContent = cutTitle(tab.title, 20);
    title.className = 'text-sm font-medium truncate leading-none';
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
  rounded-full transition duration-150 ml-2
    `;
    closeBtn.onclick = e => {
      e.stopPropagation();
      removeTab(tab.id);
    };

    tabElement.append(left, closeBtn);
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
