import ConfigAPI from './config';
import { TabManager } from './tb';
import { ValidateUrl } from './url';

// @ts-ignore
const { ScramjetController } = $scramjetLoadController();
const reload = document.getElementById('refresh') as HTMLButtonElement | null;
const back = document.getElementById('back') as HTMLButtonElement | null;
const forward = document.getElementById('forward') as HTMLButtonElement | null;
const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
const favorite = document.getElementById('fav') as HTMLButtonElement | null;
const home = document.getElementById('home');
const wispUrl = await ConfigAPI.get('wispUrl');
const nativePaths: Record<string, string> = {
  'lunar://settings': '/st',
  'lunar://new': '/new',
  'lunar://games': '/math',
  'lunar://apps': '/sci',
};
const scramjet = new ScramjetController({
  prefix: '/sj/',
  files: {
    wasm: '/a/bundled/scram/wasm.wasm',
    all: '/a/bundled/scram/all.js',
    sync: '/a/bundled/scram/sync.js',
  },
  flags: {
    captureErrors: false,
    cleanErrors: true,
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
  if (!frame?.contentWindow) return;
  loading();
  frame.src = frame.contentWindow.location.href;
});

back?.addEventListener('click', () => {
  const frame = getActiveFrame();
  frame?.contentWindow?.history.back();
});

forward?.addEventListener('click', () => {
  const frame = getActiveFrame();
  frame?.contentWindow?.history.forward();
});

home?.addEventListener('click', () => {
  const frame = getActiveFrame();
  if (!frame) return;
  frame.src = './new';
});

favorite?.addEventListener('click', async () => {
  if (!urlbar) return;

  const frame = getActiveFrame();
  if (!frame || nativePaths[urlbar.value]) return;

  const url = scramjet.decodeUrl(frame.src);
  const name = frame.contentDocument?.title || url;

  let domain: string;
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url;
  }
  // @ts-ignore
  const currentBm: Array<{ name: string; logo: string; redir: string }> =
    (await ConfigAPI.get('bm')) ?? [];

  const existingIndex = currentBm.findIndex(b => b.redir === url);

  if (existingIndex !== -1) {
    currentBm.splice(existingIndex, 1);
  } else {
    currentBm.push({
      name,
      logo: `/api/icon/?url=https://${domain}`,
      redir: url,
    });
  }

  await ConfigAPI.set('bm', currentBm);
});

urlbar?.addEventListener('keydown', async e => {
  if (e.key !== 'Enter') return;
  const frame = getActiveFrame();
  if (!frame) return;

  if (nativePaths[urlbar.value]) {
    frame.src = nativePaths[urlbar.value];
    return;
  }

  if ((await connection.getTransport()) !== '/lc/index.mjs') {
    await connection.setTransport('/lc/index.mjs', [{ wisp: wispUrl }]);
  }

  const input = (e.target as HTMLInputElement).value.trim();
  const url = scramjet.encodeUrl(await ValidateUrl(input));
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
