import TabManager from './tb';
import { ValidateUrl } from './url';
import ConfigAPI from './config';
import { BareMuxConnection } from '@mercuryworkshop/bare-mux';

TabManager.addTab();

const reload = document.getElementById('refresh') as HTMLButtonElement | null;
const back = document.getElementById('back') as HTMLButtonElement | null;
const forward = document.getElementById('forward') as HTMLButtonElement | null;
const wispUrl = await ConfigAPI.get('wispUrl');
const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
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
const connection = new BareMuxConnection('/bm/worker.js');

function ActiveFrame(): HTMLIFrameElement | null {
  const activeTabId = TabManager.activeTabId;
  const frame = document.getElementById(`frame-${activeTabId}`) as HTMLIFrameElement | null;
  console.debug('[DEBUG] Active Frame ID:', `frame-${activeTabId}`);
  return frame;
}

reload?.addEventListener('click', () => {
  const frame = ActiveFrame();
  if (frame?.contentWindow) {
    console.log('[DEBUG] Reloading frame:', frame.id);
    frame.src = frame.contentWindow.location.href;
  } else {
    console.warn('[WARN] Cannot reload: No active frame');
  }
});

back?.addEventListener('click', () => {
  const frame = ActiveFrame();
  if (frame?.contentWindow) {
    console.debug('[DEBUG] Going back in frame:', frame.id);
    frame.contentWindow.history.back();
  } else {
    console.warn('[WARN] Cannot go back: No active frame');
  }
});

forward?.addEventListener('click', () => {
  const frame = ActiveFrame();
  if (frame?.contentWindow) {
    console.debug('[DEBUG] Going forward in frame:', frame.id);
    frame.contentWindow.history.forward();
  } else {
    console.warn('[WARN] Cannot go forward: No active frame');
  }
});

urlbar?.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;

  const frame = ActiveFrame();
  if (!frame) return;

  if ((await connection.getTransport()) !== '/lc/index.mjs') {
    await connection.setTransport('/lc/index.mjs', [{ wisp: wispUrl }]);
  }

  const backend = await ConfigAPI.get('backend');
  const input = (e.target as HTMLInputElement).value.trim();
  let url = await ValidateUrl(input);

  urlbar.value = url;
  // you make my head right a round, baby, right round
  if (reload) {
    reload.style.transition = 'transform 0.5s ease';
    reload.style.animation = 'none';
    void reload.offsetWidth;
    reload.style.animation = 'spin 0.5s linear';
  }

  if (backend === 'uv') {
    url = `/pre/${UltraConfig.encodeUrl(url)}`;
  } else {
    url = scramjet.encodeUrl(url);
  }

  frame.src = url;

  let lastHref = '';
  setInterval(async () => {
    try {
      const href = frame.contentWindow?.location.href;
      if (href && href !== lastHref) {
        lastHref = href;
        urlbar.value = await getURL(href);
      }
    } catch {
      // yap sessions smh
    }
  }, 500);
});

async function getURL(proxiedUrl: string) {
  const backend = await ConfigAPI.get('backend');
  const url = new URL(proxiedUrl);

  if (backend === 'uv') {
    const path = url.pathname.slice(5);
    return UltraConfig.decodeUrl(path);
  } else {
    const path = url.pathname.slice(4);
    return scramjet.decodeUrl(path);
  }
}
