interface Tab {
  id: number;
  title: string;
}

let tabs: Tab[] = [];
let activeTabId: number | null = null;
let draggedTabId: number | null = null;
let maxTabs = calculateMaxTabs();

const tabContainer = document.getElementById("tab-container") as HTMLElement;
const addButton = document.getElementById("add") as HTMLElement;

function calculateMaxTabs(): number {
  const screenWidth = window.innerWidth;
  if (screenWidth >= 1024) return 12; // Conputer max
  if (screenWidth >= 768) return 7;   // Tablets max
  return 4;                           // Mobile max
}

function getNextTabId(): number {
  return tabs.length ? Math.max(...tabs.map((t) => t.id)) + 1 : 1;
}

function addTab(title?: string): void {
  if (tabs.length >= maxTabs) return; // Prevent exceeding max tabs

  const newTabId = getNextTabId();
  const tabTitle = title || `Tab ${newTabId}`;

  const newTab: Tab = { id: newTabId, title: tabTitle };
  tabs.push(newTab);

  activeTabId = newTabId;
  renderTabs();
}

function removeTab(tabId: number): void {
  if (tabs.length === 1) return; 

  tabs = tabs.filter((tab) => tab.id !== tabId);
  activeTabId = tabs.length ? tabs[tabs.length - 1].id : null;
  renderTabs();
}

function setActiveTab(tabId: number): void {
  activeTabId = tabId;
  renderTabs();
}

function renderTabs(): void {
  if (!tabContainer) return;
  tabContainer.innerHTML = "";

  tabs.forEach((tab) => {
    const tabElement = document.createElement("div");
    tabElement.className = `tab relative flex items-center px-4 py-2 rounded-t-lg border transition-all duration-300 ease-in-out cursor-pointer whitespace-nowrap
      ${
        activeTabId === tab.id
          ? "bg-gray-700 text-white border-blue-500"
          : "bg-gray-600 text-gray-300 border-gray-500 hover:bg-gray-500"
      }`;
    tabElement.draggable = true;
    tabElement.dataset.id = tab.id.toString();

    const titleSpan = document.createElement("span");
    titleSpan.textContent = tab.title;
    tabElement.appendChild(titleSpan);

    if (tabs.length > 1) {
      const closeButton = document.createElement("button");
      closeButton.className = "ml-3 text-gray-400 hover:text-white transition duration-200";
      closeButton.innerHTML = "✕";
      closeButton.addEventListener("click", (e) => {
        e.stopPropagation(); 
        removeTab(tab.id);
      });

      tabElement.appendChild(closeButton);
    }

    tabElement.addEventListener("click", () => setActiveTab(tab.id));

    tabElement.addEventListener("dragstart", (e) => {
      draggedTabId = tab.id;
      tabElement.classList.add("opacity-50");
      e.dataTransfer?.setData("text/plain", tab.id.toString());
    });

    tabElement.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    tabElement.addEventListener("drop", (e) => {
      e.preventDefault();
      if (draggedTabId === null || draggedTabId === tab.id) return;

      const draggedIndex = tabs.findIndex((t) => t.id === draggedTabId);
      const targetIndex = tabs.findIndex((t) => t.id === tab.id);

      if (draggedIndex > -1 && targetIndex > -1) {
        const [movedTab] = tabs.splice(draggedIndex, 1);
        tabs.splice(targetIndex, 0, movedTab);
        renderTabs();
      }
    });

    tabElement.addEventListener("dragend", () => {
      draggedTabId = null;
      renderTabs();
    });

    tabContainer.appendChild(tabElement);
  });
}

window.addEventListener("resize", () => {
  maxTabs = calculateMaxTabs();
  if (tabs.length > maxTabs) {
    tabs = tabs.slice(0, maxTabs);
    renderTabs();
  }
});

addButton.addEventListener("click", () => addTab());

addTab();
