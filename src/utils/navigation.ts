import ConfigAPI from './config';
import { scramjetWrapper } from './pro';
import { vWrapper } from './pro';
import { TabManager } from './tb';
import { validateUrl } from './url';

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

const scramjetInstance = scramjetWrapper.getConfig();
const vInstance = vWrapper.getConfig();
scramjetWrapper.init();
await navigator.serviceWorker.register('./sw.js');
const connection = new BareMux.BareMuxConnection('/bm/worker.js');

if ((await connection.getTransport()) !== '/lc/index.mjs') {
  await connection.setTransport('/lc/index.mjs', [{ wisp: wispUrl }]);
}

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

  const url = scramjetInstance.codec.decode(frame.src);
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
  let url;
  if ((await ConfigAPI.get('backend')) == 'sc') {
    url = `${scramjetInstance.prefix}${scramjetInstance.codec.encode(await validateUrl(input))}`;
  } else if ((await ConfigAPI.get('backend')) == 'u') {
    url = `${vInstance.prefix}${vInstance.encodeUrl(await validateUrl(input))}`;
  }

  loading();
  // @ts-ignore
  frame.src = url;
});

// @ts-ignore
let targetDoc: Document | null = null;

function findTargetDoc(win: Window | null): Document | null {
  while (win) {
    try {
      if (win.document?.querySelector('aside')) {
        return win.document;
      }
    } catch {}

    if (win === win.parent) break;
    win = win.parent;
  }

  try {
    const frames = window.top?.document.querySelectorAll('iframe') || [];
    for (const iframe of frames) {
      try {
        const doc = iframe.contentDocument;
        if (doc?.querySelector('aside')) return doc;
      } catch {}
    }
  } catch {}

  return null;
}

targetDoc = findTargetDoc(window);

// @ts-ignore
targetDoc.querySelectorAll<HTMLElement>('aside button, aside img').forEach(el => {
  el.addEventListener('click', () => {
    const frame = getActiveFrame();
    if (!frame) return;

    const targetUrl = el.tagName === 'BUTTON' ? el.getAttribute('data-url') : '/new';

    if (!targetUrl) return;

    const nativeKey = Object.keys(nativePaths).find(key => nativePaths[key] === targetUrl);
    if (!nativeKey) return;

    if (urlbar) urlbar.value = nativeKey;
    frame.src = nativePaths[nativeKey];
    loading();
  });
});
