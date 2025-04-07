interface Tab {
  id: number;
  title: string;
  favicon: string;
  iframe: HTMLIFrameElement;
}

const defaultURL = '/a/images/logo/moon.svg';
const IconURL = '/api/icon/?url=';

let tabs: Tab[] = [];
let activeTabId: number | null = null;
let draggedTabId: number | null = null;
let tabCounter = 1;

// @ts-ignore scramjet is needed ig
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

const tabContainer = document.getElementById('tcontainer') as HTMLDivElement;
const addbtn = document.getElementById('add') as HTMLButtonElement;
const frameContainer = document.getElementById('fcontainer') as HTMLDivElement;

tabContainer.classList.add(
  'flex',
  'justify-center',
  'items-center',
  'mt-4',
  'overflow-x-auto'
);

function getNextTabId() {
  return tabCounter++;
}

function addTab() {
  const newTabId = getNextTabId();
  const iframe = document.createElement('iframe');
  iframe.id = `frame-${newTabId}`;
  iframe.src = 'new';
  iframe.classList.add('w-full', 'h-full', 'hidden');
  frameContainer.appendChild(iframe);

  const newTab: Tab = {
    id: newTabId,
    title: 'New Tab',
    favicon: defaultURL,
    iframe,
  };

  tabs.push(newTab);
  setActiveTab(newTabId);
  renderTabs();

  iframe.onload = () => {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const maxLength = 18;
    newTab.title = doc.title?.length > maxLength
      ? `${doc.title.slice(0, maxLength)}...`
      : doc.title || 'New Tab';

    try {
      const url = new URL(doc.URL);
      if (url.origin === window.location.origin) {
        newTab.favicon = defaultURL;
        throw new Error('same origin, stopping..');
      }

      fetch(IconURL + encodeURIComponent(url.origin))
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            newTab.favicon = (reader.result as string) || defaultURL;
            renderTabs();
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => {
          newTab.favicon = defaultURL;
          renderTabs();
        });

    } catch {
    }

    renderTabs();
  };
}

function setActiveTab(tabId: number) {
  activeTabId = tabId;
  document.querySelectorAll('iframe').forEach(iframe =>
    iframe.classList.add('hidden')
  );
  document.getElementById(`frame-${tabId}`)?.classList.remove('hidden');

  document.querySelectorAll('.tab').forEach(tabElement => {
    const isActive = parseInt(tabElement.getAttribute('data-id') || '') === tabId;
    tabElement.classList.toggle('bg-gray-700', isActive);
    tabElement.classList.toggle('bg-gray-600', !isActive);
  });
}

function removeTab(tabId: number) {
  const tabIndex = tabs.findIndex(tab => tab.id === tabId);
  if (tabIndex === -1) return;

  document.getElementById(`frame-${tabId}`)?.remove();
  tabs.splice(tabIndex, 1);

  activeTabId = tabs.length ? tabs[tabs.length - 1].id : null;
  renderTabs();
  if (activeTabId !== null) setActiveTab(activeTabId);
  if (tabs.length === 0) addTab();
}

function renderTabs() {
  tabContainer.innerHTML = '';

  tabs.forEach(tab => {
    const tabElement = document.createElement('div');
    tabElement.className = `h-9 tab mb-4 px-4 py-2 min-w-[210px] rounded-md transition-all cursor-pointer
      ${TabManager.activeTabId === tab.id ? 'bg-gray-700' : 'bg-gray-600'} text-white flex items-center`;
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

    tabElement.onclick = () => {
      TabManager.activeTabId = tab.id;
    };

    tabElement.ondragstart = (e) => {
      draggedTabId = tab.id;
      tabElement.classList.add('opacity-50');
      e.dataTransfer?.setData('text/plain', tab.id.toString());
    };

    tabElement.ondragover = (e) => e.preventDefault();

    tabElement.ondrop = (e) => {
      e.preventDefault();
      if (draggedTabId === null || draggedTabId === tab.id) return;

      const draggedIndex = tabs.findIndex(t => t.id === draggedTabId);
      const targetIndex = tabs.findIndex(t => t.id === tab.id);

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
  get activeTabId() {
    return activeTabId;
  },
  set activeTabId(newTabId: number | null) {
    activeTabId = newTabId;
    if (newTabId !== null) {
      setActiveTab(newTabId);
    }
  },
  addTab,
};

export default TabManager;
