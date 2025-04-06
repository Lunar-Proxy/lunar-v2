import ConfigAPI from './config';
import TabManager from './tb';
import { Search } from './search';
import { BareMuxConnection } from '@mercuryworkshop/bare-mux';

const wispUrl = await ConfigAPI.get('wispUrl');
console.log('[DEBUG] Wisp URL:', wispUrl);

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

TabManager.addTab();
scramjet.init();

const connection = new BareMuxConnection('/bm/worker.js');
const sch = document.querySelector('input[type="text"]') as HTMLInputElement | null;
const reload = document.querySelector('button[id="refresh"]') as HTMLButtonElement | null;
const back = document.querySelector('button[id="back"]') as HTMLButtonElement | null;
const foward = document.querySelector('button[id="foward"]') as HTMLButtonElement | null;

navigator.serviceWorker.register('./sw.js');

sch?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const value = sch?.value.trim();
    if (value) {
      launch(value);
    }
  }
});

function ActiveFrame(): HTMLIFrameElement | null {
  const activeTabId = TabManager.activeTabId;
  const frame = document.getElementById(`frame-${activeTabId}`) as HTMLIFrameElement | null;
  console.log("[DEBUG] Active Frame ID:", `frame-${activeTabId}`);
  return frame;
}

async function launch(value: string) {
  const frame = ActiveFrame();
  if (!frame) {
    console.warn("[WARN] No active frame found for launch");
    return;
  }

  if ((await connection.getTransport()) !== '/lc/index.mjs') {
    await connection.setTransport('/lc/index.mjs', [{ wisp: wispUrl }]);
  }

  const url = await Search(value);
  console.log('[DEBUG] Searching for:', url);

  const backend = await ConfigAPI.get('backend');
  if (backend === 'uv') {
    frame.src = `/pre/${UltraConfig.encodeUrl(url)}`;
  } else if (backend === 'sj') {
    frame.src = `${scramjet.encodeUrl(url)}`;
  } else {
    console.warn('[WARN] Unknown backend:', backend);
  }
}

reload?.addEventListener('click', () => {
  const frame = ActiveFrame();
  if (frame?.contentWindow) {
    console.log("[DEBUG] Reloading frame:", frame.id);
    frame.src = frame.contentWindow.location.href;
  } else {
    console.warn("[WARN] Cannot reload: No active frame");
  }
});

back?.addEventListener('click', () => {
  const frame = ActiveFrame();
  if (frame?.contentWindow) {
    console.log("[DEBUG] Going back in frame:", frame.id);
    frame.contentWindow.history.back()
  } else {
    console.warn("[WARN] Cannot go back: No active frame");
  }
});

foward?.addEventListener('click', () => {
  const frame = ActiveFrame();
  if (frame?.contentWindow) {
    console.log("[DEBUG] Going forward in frame:", frame.id);
    frame.contentWindow.history.forward()
  } else {
    console.warn("[WARN] Cannot go forward: No active frame");
  }
});
