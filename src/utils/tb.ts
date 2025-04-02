interface Tab {
  id: number;
  title: string;
  favicon: string;
}

declare global {
  interface Window {
    __uv$location?: Location;
  }

  interface Location {
    __uv$location?: Location;
  }

  var __uv$location: Location | undefined;
}

let tabs: Tab[] = [];
let activeTabId: number | null = null;
let draggedTabId: number | null = null;

const scramjet = new ScramjetController({
  prefix: '/sj/',
  files: {
    wasm: '/a/bundled/scram/wasm.wasm',
    worker: '/a/bundled/scram/worker.js',
    client: '/a/bundled/scram/client.js',
    shared: '/a/bundled/scram/shared.js',
    sync: '/a/bundled/scram/sync.js',
  },
  flags: {
    serviceworkers: true,
    syncxhr: true,
  },
});
const tabContainer = document.getElementById('tcontainer')!;
const addbtn = document.getElementById('add')!;
const frameContainer = document.getElementById('fcontainer')!;
const input = document.querySelector('input[type="text"]') as HTMLInputElement | null;
tabContainer.classList.add('flex', 'justify-center', 'items-center', 'mt-4', 'overflow-x-auto');

function getNextTabId() {
  return tabs.length ? Math.max(...tabs.map((t) => t.id)) + 1 : 1;
}

function addTab() {
  const newTabId = getNextTabId();
  const iframe = document.createElement('iframe');
  iframe.id = `frame-${newTabId}`;
  iframe.src = 'new';
  iframe.classList.add('w-full', 'h-full', 'hidden');
  frameContainer.appendChild(iframe);

  const newTab = { id: newTabId, title: "New Tab", favicon: '/a/images/logo/moon.svg' };
  tabs.push(newTab);

  setActiveTab(newTabId);
  renderTabs();

  iframe.onload = () => {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      const href = iframe.contentWindow?.location.href || ''; 
      let extracted = '';
      if (href.includes('/pre/')) {
        extracted = href.split('/pre/')[1];  
        extracted = UltraConfig.decodeUrl(extracted) ?? '';  
      } else if (href.includes('/sj/')) {
        extracted = href.split('/sj/')[1];    
        extracted = scramjet.decodeUrl(extracted) ?? '';  
      }
      console.log('[DEBUG] extracted URL:', extracted);
      newTab.title = doc.title || 'Unknown';
      // ts pmo todo: make it get website favicon
      newTab.favicon = '/a/images/logo/moon.svg';
      if (input) {
      input.value = extracted
      }
  
      renderTabs();
    }
  };  
}

function ActiveTabId(): number | null {
  return activeTabId;
}

function removeTab(tabId: number) {
  document.getElementById(`frame-${tabId}`)?.remove();
  tabs = tabs.filter((tab) => tab.id !== tabId);
  activeTabId = tabs.length ? tabs[tabs.length - 1].id : null;
  renderTabs();
  if (activeTabId !== null) setActiveTab(activeTabId);
  if (tabs.length === 0) addTab();
}

function setActiveTab(tabId: number) {
  activeTabId = tabId;
  document.querySelectorAll('iframe').forEach((iframe) => iframe.classList.add('hidden'));
  document.getElementById(`frame-${tabId}`)?.classList.remove('hidden');

  document.querySelectorAll('.tab').forEach((tabElement) => {
    const tabIdAttr = tabElement.getAttribute('data-id');
    if (tabIdAttr) {
      const isActive = parseInt(tabIdAttr) === tabId;
      tabElement.classList.toggle('bg-gray-700', isActive);
      tabElement.classList.toggle('bg-gray-600', !isActive);
    }
  });
}

function renderTabs() {
  if (!tabContainer) return;
  tabContainer.innerHTML = '';

  tabs.forEach((tab, index) => {
    console.log('[DEBUG] index is', index);
    const tabElement = document.createElement('div');
    tabElement.className = `h-9 tab mb-4 px-4 py-2 min-w-[210px] rounded-md transition-all cursor-pointer
    ${activeTabId === tab.id ? 'bg-gray-700 text-white' : 'bg-gray-600 text-white'} flex items-center`;
    tabElement.draggable = true;
    tabElement.dataset.id = tab.id.toString();

    const tbContent = document.createElement('div');
    tbContent.className = 'flex items-center w-full';

    const favicon = document.createElement('img');
    favicon.src = tab.favicon;
    favicon.alt = 'favicon';
    favicon.className = 'w-4 h-4 rounded-full mr-2';

    const title = document.createElement('span');
    title.textContent = tab.title;
    title.className = 'text-left font-linux text-sm font-semibold truncate flex-grow';

    const closeButton = document.createElement('button');
    closeButton.className =
      'text-gray-400 hover:bg-gray-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center transition-all text-sm aspect-square ml-auto';
    closeButton.innerHTML = '✕';
    closeButton.onclick = (e) => {
      e.stopPropagation();
      removeTab(tab.id);
    };

    tbContent.appendChild(favicon);
    tbContent.appendChild(title);
    tbContent.appendChild(closeButton);
    tabElement.appendChild(tbContent);

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
      if (draggedIndex > -1 && targetIndex > -1) {
        const [movedTab] = tabs.splice(draggedIndex, 1);
        tabs.splice(targetIndex, 0, movedTab);
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

addbtn.addEventListener('click', addTab);

const TabManager = {
  addTab,
  ActiveTabId,
};

export default TabManager;
