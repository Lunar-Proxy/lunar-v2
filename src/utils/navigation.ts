import TabManager from './tb';
import { ValidateUrl } from './url';
import ConfigAPI from './config';

TabManager.addTab();

const reload = document.getElementById('refresh') as HTMLButtonElement | null;
const back = document.getElementById('back') as HTMLButtonElement | null;
const forward = document.getElementById('forward') as HTMLButtonElement | null;
const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
const devtools = document.getElementById('code') as HTMLButtonElement | null;
const wispUrl = await ConfigAPI.get('wispUrl');
const backend = await ConfigAPI.get('backend');
const scramjet = new ScramjetController({
  prefix: '/sj/',
  files: {
    wasm: '/a/bundled/scram/wasm.wasm',
    worker: '/a/bundled/scram/worker.js',
    client: '/a/bundled/scram/client.js',
    shared: '/a/bundled/scram/shared.js',
    sync: '/a/bundled/scram/sync.js',
  },
});
scramjet.init();

navigator.serviceWorker.register('./sw.js');

const connection = new BareMux.BareMuxConnection('/bm/worker.js');

function getActiveFrame(): HTMLIFrameElement | null {
  const activeTabId = TabManager.activeTabId;
  return document.getElementById(`frame-${activeTabId}`) as HTMLIFrameElement | null;
}

function loading() {
  // baby you spin me right around, baby right round
  if (!reload) return;
  reload.style.transition = 'transform 0.5s ease';
  reload.style.animation = 'none';
  void reload.offsetWidth;
  reload.style.animation = 'spin 0.5s linear';
}

async function getURL(proxiedUrl: string) {
  const url = new URL(proxiedUrl);
  const path = backend === 'uv' ? url.pathname.slice(5) : url.pathname.slice(4);
  return backend === 'uv' ? UltraConfig.decodeUrl(path) : scramjet.decodeUrl(path);
}

reload?.addEventListener('click', () => {
  const frame = getActiveFrame();
  if (frame?.contentWindow) {
    console.log('[DEBUG] Reloading frame:', frame.id);
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

devtools?.addEventListener('click', () => {
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
      const script = frame?.contentDocument.createElement('script');
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


urlbar?.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;

  const frame = getActiveFrame();
  if (!frame) return;

  if ((await connection.getTransport()) !== '/lc/index.mjs') {
    await connection.setTransport('/lc/index.mjs', [{ wisp: wispUrl }]);
  }

  const input = (e.target as HTMLInputElement).value.trim();
  let url = await ValidateUrl(input);

  urlbar.value = url;
  loading();

  url = backend === 'uv' ? `/pre/${UltraConfig.encodeUrl(url)}` : scramjet.encodeUrl(url);
  frame.src = url;

  let lastHref = '';
  setInterval(async () => {
    try {
      const href = frame.contentWindow?.location.href;
      if (href && href !== lastHref) {
        lastHref = href;
        urlbar.value = (await getURL(href)) ?? ''; // shouldnt be blank but wtv
      }
    } catch {
      // yap session smh
    }
  }, 500);
});
