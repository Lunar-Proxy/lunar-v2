interface Tab {
  id: number;
  title: string;
  favicon: string;
  iframe: HTMLIFrameElement;
}

const defaultFavicon = '/a/images/logo/moon.svg';
const iconURL = '/api/icon/?url=';

let tabs: Tab[] = [];
let activeTabId: number | null = null;
let draggedTabId: number | null = null;
let tabCounter = 1;

const tabContainer = document.getElementById('tcontainer') as HTMLDivElement;
const frameContainer = document.getElementById('fcontainer') as HTMLDivElement;

tabContainer.classList.add('flex', 'justify-center', 'items-center', 'mt-4', 'overflow-x-auto');

function getNextId(): number {
  return tabCounter++;
}

function createframe(id: number, url?: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.id = `frame-${id}`;
  iframe.src = url ?? 'new';
  iframe.classList.add('w-full', 'h-full', 'hidden');
  return iframe;
}

function addTab(url?: string): void {
  const id = getNextId();
  const iframe = createframe(id, url);
  frameContainer.appendChild(iframe);

  const tab: Tab = {
    id,
    title: 'New Tab',
    favicon: defaultFavicon,
    iframe,
  };

  tabs.push(tab);
  setActiveTab(id);
  renderTabs();

  iframe.onload = () => handleLoad(tab);
}

function handleLoad(tab: Tab): void {
  const doc = tab.iframe.contentDocument || tab.iframe.contentWindow?.document;
  if (!doc) return;

  const title = doc.title?.trim() || 'New Tab';
  tab.title = title.length > 16 ? title.slice(0, 16) + '...' : title;

  try {
    const url = new URL(doc.URL);
    if (url.origin === location.origin) throw new Error('Same origin');

    fetch(iconURL + encodeURIComponent(url.origin))
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          tab.favicon = (reader.result as string) || defaultFavicon;
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

  document.querySelectorAll('iframe').forEach((iframe) => {
    iframe.classList.add('hidden');
  });

  document.getElementById(`frame-${id}`)?.classList.remove('hidden');

  document.querySelectorAll('.tab').forEach((el) => {
    const isActive = parseInt(el.getAttribute('data-id') || '') === id;
    el.classList.toggle('bg-[#2e2c45]', isActive);
    el.classList.toggle('bg-[#29263c]', !isActive);
  });
}

function removeTab(id: number): void {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index === -1) return;

  tabs[index].iframe.remove();
  tabs.splice(index, 1);

  if (tabs.length === 0) {
    activeTabId = null;
    addTab();
  } else {
    activeTabId = tabs[tabs.length - 1].id;
    setActiveTab(activeTabId);
  }

  renderTabs();
}

function renderTabs(): void {
  tabContainer.innerHTML = '';

  tabs.forEach((tab) => {
    const tabElement = document.createElement('div');
    tabElement.className = `
      h-9 tab mb-4 px-4 py-2 min-w-[210px] border-[#3a3758] border rounded-md transition-all cursor-pointer
      ${activeTabId === tab.id ? 'bg-[#2e2c45]' : 'bg-[#29263c]'}
      text-white flex items-center`;
    tabElement.draggable = true;
    tabElement.dataset.id = tab.id.toString();

    const content = document.createElement('div');
    content.className = 'flex items-center w-full';

    const favicon = document.createElement('img');
    favicon.src = tab.favicon;
    favicon.alt = 'favicon';
    favicon.className = 'w-4 h-4 rounded-full mr-2';

    const title = document.createElement('span');
    title.textContent = tab.title;
    title.className = 'text-left font-linux text-sm font-semibold truncate grow';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.className = `
      text-gray-400 hover:bg-gray-500 font-semibold hover:text-white rounded-full w-6 h-6
      flex items-center justify-center transition-all text-sm aspect-square ml-auto`;
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      removeTab(tab.id);
    };

    content.append(favicon, title, closeBtn);
    tabElement.appendChild(content);

    tabElement.onclick = () => setActiveTab(tab.id);

    tabElement.ondragstart = (e) => {
      draggedTabId = tab.id;
      tabElement.classList.add('opacity-50');
      e.dataTransfer?.setData('text/plain', tab.id.toString());
    };

    tabElement.ondragover = (e) => e.preventDefault();

    tabElement.ondrop = (e) => {
      e.preventDefault();
      if (draggedTabId === null || draggedTabId === tab.id) return;

      const draggedIndex = tabs.findIndex((t) => t.id === draggedTabId);
      const targetIndex = tabs.findIndex((t) => t.id === tab.id);

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
}

document.addEventListener('DOMContentLoaded', () => {
  const addbtn = document.getElementById('add') as HTMLButtonElement;
  addbtn?.addEventListener('click', () => addTab());
});

const TabManager = {
  get activeTabId() {
    return activeTabId;
  },
  set activeTabId(id: number | null) {
    if (id !== null) setActiveTab(id);
  },
  addTab,
};

export default TabManager;
