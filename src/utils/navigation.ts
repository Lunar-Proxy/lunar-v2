import ConfigAPI from './config';
import { TabManager } from './tb';
import { ValidateUrl } from './url';

// @ts-ignore
const { ScramjetController } = $scramjetLoadController();
const reload = document.getElementById('refresh') as HTMLButtonElement | null;
const back = document.getElementById('back') as HTMLButtonElement | null;
const forward = document.getElementById('forward') as HTMLButtonElement | null;
const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
const menu = document.getElementById('menubtn') as HTMLButtonElement | null;
const cmenu = document.getElementById("menu") as HTMLDivElement | null
const wispUrl = await ConfigAPI.get('wispUrl');
const inspectElement = document.querySelector('#menu .menu-item:nth-child(3)');
const fullscreen = document.querySelector('#menu .menu-item:nth-child(2)');

const nativePaths: Record<string, string> = {
  'lunar://settings': '/st',
  'lunar://new': '/new',
  'lunar://games': '/math',
};

const scramjet = new ScramjetController({
  prefix: '/sj/',
  files: {
    wasm: '/a/bundled/scram/wasm.wasm',
    all: '/a/bundled/scram/all.js',
    sync: '/a/bundled/scram/sync.js',
  },
  flags: {
    captureErrors: true,
    cleanErrors: false,
    rewriterLogs: false,
    scramitize: false,
    serviceworkers: false,
    strictRewrites: true,
    syncxhr: false,
  },
});

await scramjet.init();
await navigator.serviceWorker.register('./sw.js');
const connection = new BareMux.BareMuxConnection('/bm/worker.js');

function getActiveFrame(): HTMLIFrameElement | null {
  const activeTabId = TabManager.activeTabId;
  return document.getElementById(`frame-${activeTabId}`) as HTMLIFrameElement | null;
}

function loading() {
  if (!reload) return;
  reload.style.transition = 'transform 0.5s ease';
  reload.style.animation = 'none';
  void reload.offsetWidth; // force
  reload.style.animation = 'spin 0.5s linear';
}

reload?.addEventListener('click', () => {
  const frame = getActiveFrame();
  if (frame?.contentWindow) {
    console.log('[DEBUG] Reloading frame:', frame.id);
    loading();
    frame.src = frame.contentWindow.location.href;
  } else {
    console.warn('[WARN] Cannot reload: No active frame');
  }
});

back?.addEventListener('click', () => {
  const frame = getActiveFrame();
  if (frame?.contentWindow) {
    console.debug('[DEBUG] Going back in frame:', frame.id);
    frame.contentWindow.history.back();
  } else {
    console.warn('[WARN] Cannot go back: No active frame');
  }
});

forward?.addEventListener('click', () => {
  const frame = getActiveFrame();
  if (frame?.contentWindow) {
    console.debug('[DEBUG] Going forward in frame:', frame.id);
    frame.contentWindow.history.forward();
  } else {
    console.warn('[WARN] Cannot go forward: No active frame');
  }
});

if (menu && cmenu) {
  const toggleMenu = (e: MouseEvent) => {
    e.stopPropagation();
    cmenu.classList.toggle('hidden');
  };

  const hideMenu = () => {
    if (!cmenu.classList.contains('hidden')) {
      cmenu.classList.add('hidden');
    }
  };

  menu.addEventListener('click', toggleMenu);

  document.addEventListener('click', (e: MouseEvent) => {
    if (!menu.contains(e.target as Node) && !cmenu.contains(e.target as Node)) {
      hideMenu();
    }
  });

  window.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement?.tagName === 'IFRAME') {
        hideMenu();
      }
    }, 0);
  });

  const menuItems = cmenu.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', hideMenu);
  });
}

fullscreen?.addEventListener('click', () => {
  if (!top?.document.fullscreenElement) {
    top?.document.documentElement.requestFullscreen().catch(err => {
      console.error('[ERROR] Failed to enter fullscreen:', err);
    });
  } else {
    top?.document.exitFullscreen().catch(err => {
      console.error('[ERROR] Failed to exit fullscreen:', err);
    });
  }
});

inspectElement?.addEventListener('click', () => {
  const frame = getActiveFrame();
  try {
    const eruda = frame?.contentWindow?.eruda;

    if (eruda?._isInit) {
      eruda.destroy();
      console.debug('[DEBUG] Eruda console destroyed.');
      return;
    }

    if (!eruda) {
      console.debug('[DEBUG] Eruda console not loaded yet.');
    } else {
      console.debug('[DEBUG] Eruda console is not initialized.');
    }

    if (frame?.contentDocument) {
      const script = frame.contentDocument.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/eruda';
      script.onload = () => {
        frame.contentWindow?.eruda.init();
        frame.contentWindow?.eruda.show();
        console.debug('[DEBUG] Eruda console initialized.');
      };
      frame.contentDocument.head.appendChild(script);
    } else {
      throw new Error('[ERROR] Cannot inject script.');
    }
  } catch (err) {
    console.error('[ERROR] Failed to toggle Eruda:', err);
  }
});

urlbar?.addEventListener('keydown', async e => {
  if (e.key !== 'Enter') return;

  const frame = getActiveFrame();
  if (!frame) {
    console.warn('[WARN] No active frame to navigate.');
    return;
  }

  if (nativePaths[urlbar.value]) {
    frame.src = nativePaths[urlbar.value];
    return;
  }

  if ((await connection.getTransport()) !== '/lc/index.mjs') {
    await connection.setTransport('/lc/index.mjs', [{ wisp: wispUrl }]);
  }

  const input = (e.target as HTMLInputElement).value.trim();
  let url = await ValidateUrl(input);

  urlbar.value = url;
  loading();

  url = scramjet.encodeUrl(url);
  frame.src = url;
});

// @ts-ignore ig
const elements = window.top.document.querySelectorAll<HTMLElement>('aside button, aside img');

elements.forEach(el => {
  el.addEventListener('click', async () => {
    const frame = getActiveFrame();
    if (!frame) return;
    
    let targetUrl: string | undefined;
    if (el.tagName.toLowerCase() === 'button') {
      targetUrl = el.dataset.url;
    } else if (el.tagName.toLowerCase() === 'img') {
      targetUrl = '/new';
    }

    if (!targetUrl) return;

    const nativeKey = Object.keys(nativePaths).find(key => nativePaths[key] === targetUrl);
    if (nativeKey) {
      if (urlbar) urlbar.value = nativeKey;
      frame.src = nativePaths[nativeKey];
      loading();
      return;
    }
  });
});
