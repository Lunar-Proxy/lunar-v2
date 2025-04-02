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
navigator.serviceWorker.register('./sw.js');

sch?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const value = sch?.value.trim();
    if (value) {
      launch(value);
    }
  }
});

async function launch(value: string) {
  const activeTabId = TabManager.ActiveTabId();
  if ((await connection.getTransport()) !== '/lc/index.mjs') {
    await connection.setTransport('/lc/index.mjs', [{ wisp: wispUrl }]);
  }
  const frame = document.getElementById(`frame-${activeTabId}`) as HTMLIFrameElement;
  const url = await Search(value);
  console.log('[DEBUG] Searching for:', url);
  if ((await ConfigAPI.get('backend')) === 'uv') {
    frame.src = `/pre/${UltraConfig.encodeUrl(url)}`;
  } else if ((await ConfigAPI.get('backend')) === 'sj') {
    frame.src = `${scramjet.encodeUrl(url)}`;
  }
}
