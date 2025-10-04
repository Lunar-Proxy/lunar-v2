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
const cmenu = document.getElementById('menu') as HTMLDivElement | null;
const inspectElement = document.querySelector('#menu .menu-item:nth-child(3)');
const fullscreen = document.querySelector('#menu .menu-item:nth-child(2)');

const wispUrl = await ConfigAPI.get('wispUrl');

export const nativePaths: Record<string, string> = {
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
  return document.getElementById(`frame-${TabManager.activeTabId}`) as HTMLIFrameElement | null;
}

function loading() {
  if (!reload) return;
  reload.style.transition = 'transform 0.5s ease';
  reload.style.animation = 'none';
  void reload.offsetWidth;
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
  if (frame?.contentWindow) frame.contentWindow.history.back();
  else console.warn('[WARN] Cannot go back: No active frame');
});

forward?.addEventListener('click', () => {
  const frame = getActiveFrame();
  if (frame?.contentWindow) frame.contentWindow.history.forward();
  else console.warn('[WARN] Cannot go forward: No active frame');
});

if (menu && cmenu) {
  const toggleMenu = (e: MouseEvent) => {
    e.stopPropagation();
    cmenu.classList.toggle('hidden');
  };

  const hideMenu = () => cmenu.classList.add('hidden');

  menu.addEventListener('click', toggleMenu);

  document.addEventListener('click', e => {
    if (!menu.contains(e.target as Node) && !cmenu.contains(e.target as Node)) hideMenu();
  });

  window.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement?.tagName === 'IFRAME') hideMenu();
    }, 0);
  });

  cmenu.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', hideMenu);
  });
}

fullscreen?.addEventListener('click', () => {
  const doc = top?.document;
  if (!doc?.fullscreenElement) {
    doc?.documentElement.requestFullscreen().catch(err => console.error('[ERROR] Failed to enter fullscreen:', err));
  } else {
    doc.exitFullscreen().catch(err => console.error('[ERROR] Failed to exit fullscreen:', err));
  }
});

inspectElement?.addEventListener('click', () => {
  const frame = getActiveFrame();
  try {
    const eruda = frame?.contentWindow?.eruda;
    if (eruda?._isInit) return eruda.destroy();

    if (!eruda && frame?.contentDocument) {
      const script = frame.contentDocument.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/eruda';
      script.onload = () => frame.contentWindow?.eruda.init();
      frame.contentDocument.head.appendChild(script);
    }
  } catch (err) {
    console.error('[ERROR] Failed to toggle Eruda:', err);
  }
});

urlbar?.addEventListener('keydown', async e => {
  if (e.key !== 'Enter') return;
  const frame = getActiveFrame();
  if (!frame) return console.warn('[WARN] No active frame to navigate.');

  if (nativePaths[urlbar.value]) {
    frame.src = nativePaths[urlbar.value];
    return;
  }

  if ((await connection.getTransport()) !== '/lc/index.mjs') {
    await connection.setTransport('/lc/index.mjs', [{ wisp: wispUrl }]);
  }

  const input = (e.target as HTMLInputElement).value.trim();
  const url = scramjet.encodeUrl(await ValidateUrl(input));
  urlbar.value = url;
  loading();
  frame.src = url;
});

// @ts-ignore
window.top.document.querySelectorAll<HTMLElement>('aside button, aside img').forEach(el => {
  el.addEventListener('click', async () => {
    const frame = getActiveFrame();
    if (!frame) return;

    let targetUrl: string | undefined;
    if (el.tagName.toLowerCase() === 'button') targetUrl = el.dataset.url;
    else if (el.tagName.toLowerCase() === 'img') targetUrl = '/new';
    if (!targetUrl) return;

    const nativeKey = Object.keys(nativePaths).find(key => nativePaths[key] === targetUrl);
    if (nativeKey) {
      if (urlbar) urlbar.value = nativeKey;
      frame.src = nativePaths[nativeKey];
      loading();
    }
  });
});
