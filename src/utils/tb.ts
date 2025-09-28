interface Tab {
  id: number;
  title: string;
  favicon: string;
  iframe: HTMLIFrameElement;
}

const defaultFavicon = "/a/images/logo/moon.svg";
const iconURL = "/api/icon/?url=";

let tabs: Tab[] = [];
let activeTabId: number | null = null;
let draggedTabId: number | null = null;
let tabCounter = 1;

const tabContainer = document.getElementById("tcontainer") as HTMLDivElement;
const frameContainer = document.getElementById("fcontainer") as HTMLDivElement;

function getNextId(): number {
  return tabCounter++;
}

function createFrame(id: number, url?: string): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.id = `frame-${id}`;
  iframe.src = url ?? "about:blank";
  iframe.classList.add("w-full", "h-full", "hidden");
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  return iframe;
}

function addTab(url?: string): void {
  const id = getNextId();
  const iframe = createFrame(id, url ?? "about:blank");
  frameContainer.appendChild(iframe);

  const tab: Tab = {
    id,
    title: "New Tab",
    favicon: defaultFavicon,
    iframe,
  };

  tabs.push(tab);
  setActiveTab(id);
  renderTabs();

  iframe.onload = () => handleLoad(tab);
  // @ts-ignore
  document.getElementById("urlbar")!.value = "lunar://new";
}

function handleLoad(tab: Tab): void {
  try {
    const doc = tab.iframe.contentDocument;
    if (!doc) return;

    const title = doc.title?.trim() || "New Tab";
    tab.title = title;

    const url = new URL(tab.iframe.src);
    if (url.origin === location.origin) throw new Error("Same origin");

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

  document.querySelectorAll("iframe").forEach((iframe) => {
    iframe.classList.add("hidden");
  });

  const frame = document.getElementById(`frame-${id}`) as HTMLIFrameElement | null;
  const input = document.getElementById("urlbar") as HTMLInputElement;

  if (!frame || !input) return;

  frame.classList.remove("hidden");

  let previousUrl = frame.src; 

  const nativePaths: Record<string, string> = {
    'lunar://settings': '/st',
    'lunar://new': '/new',
    'lunar://games': '/gm',
  };

  const updateUrl = () => {
    if (frame.src !== previousUrl) { 
      previousUrl = frame.src;

      const iframeSrc = new URL(frame.src, window.location.origin).pathname;

      const nativeEntry = Object.entries(nativePaths).find(
        ([_, shortPath]) => shortPath === iframeSrc
      );

      if (nativeEntry) {
        const [fullUrl] = nativeEntry;
        input.value = fullUrl;
      } else {
        let modifiedUrl = frame.src.split("/sj/")[1] || "";
        input.value = decodeURIComponent(modifiedUrl);
      }
    }
  };

  setInterval(updateUrl, 5);

  document.querySelectorAll(".tab").forEach((el) => {
    const isActive = parseInt(el.getAttribute("data-id") || "") === id;
    el.classList.toggle("bg-[#2e2c45]", isActive);
    el.classList.toggle("bg-[#29263c]", !isActive);
  });
}

function removeTab(id: number): void {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index === -1) return;

  tabs[index].iframe.remove();
  tabs.splice(index, 1);

  if (tabs.length === 0) {
    activeTabId = null;
    addTab("new");
  } else {
    activeTabId = tabs[Math.max(0, index - 1)]?.id ?? tabs[0].id;
    setActiveTab(activeTabId);
  }
  renderTabs();
}

function renderTabs(): void {
  tabContainer.innerHTML = "";

  tabs.forEach((tab) => {
    const tabElement = document.createElement("div");
    tabElement.className = `
      tab flex items-center h-9 min-w-[210px] px-3 py-1 rounded-md border border-[#3a3758] cursor-pointer
      ${activeTabId === tab.id ? "bg-[#2e2c45]" : "bg-[#29263c]"}
      transition-all`;

    tabElement.draggable = true;
    tabElement.dataset.id = tab.id.toString();

    const favicon = document.createElement("img");
    favicon.src = tab.favicon;
    favicon.alt = "favicon";
    favicon.className = "w-4 h-4 rounded-full mr-2";

    const title = document.createElement("span");
    title.textContent = tab.title;
    title.className = "text-sm font-medium truncate grow";

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.className =
      "ml-2 flex-shrink-0 w-6 h-6 flex items-center justify-center text-xl font-medium text-gray-400 hover:bg-gray-600 hover:text-white rounded transition";

    closeBtn.onclick = (e) => {
      e.stopPropagation();
      removeTab(tab.id);
    };

    tabElement.append(favicon, title, closeBtn);

    tabElement.onclick = () => setActiveTab(tab.id);

    tabElement.ondragstart = (e) => {
      draggedTabId = tab.id;
      tabElement.classList.add("opacity-50");
      e.dataTransfer?.setData("text/plain", tab.id.toString());
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

document.addEventListener("DOMContentLoaded", () => {
  const addBtn = document.getElementById("add") as HTMLButtonElement;
  addBtn?.addEventListener("click", () => addTab("new"));
  addTab("new");
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
