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

async function updateBookmark() {
  if (!favorite) return;
  const frame = getActiveFrame();
  if (!frame) return;

  let src = frame.src;
  try {
    const urlObj = new URL(src, window.location.origin);
    let path = urlObj.pathname;
    if (path.startsWith(scramjetInstance.prefix)) {
      path = path.slice(scramjetInstance.prefix.length);
    }
    src = path;
  } catch {}

  const url = scramjetInstance.codec.decode(src);

  const currentBm = ((await ConfigAPI.get('bm')) ?? []) as Array<{ name: string; logo: string; redir: string }>;

  function normalize(u: string) {
    try {
      return decodeURIComponent(u).replace(/\/$/, '');
    } catch {
      return u.replace(/\/$/, '');
    }
  }

  const normUrl = normalize(url);
  const isBookmarked = currentBm.some(b => normalize(b.redir) === normUrl);

  const svg = favorite.querySelector('svg');
  if (svg) {
    if (isBookmarked) {
      svg.style.fill = '#a8a3c7';
      svg.style.stroke = '#a8a3c7';
    } else {
      svg.style.fill = 'none';
      svg.style.stroke = '';
    }
  }
}

reload?.addEventListener('click', () => {
  const frame = getActiveFrame();
  if (!frame?.contentWindow) return;
  loading();
  frame.src = frame.contentWindow.location.href;
  frame.addEventListener('load', updateBookmark, { once: true });
});

back?.addEventListener('click', () => {
  const frame = getActiveFrame();
  frame?.contentWindow?.history.back();
  setTimeout(updateBookmark, 100);
});

forward?.addEventListener('click', () => {
  const frame = getActiveFrame();
  frame?.contentWindow?.history.forward();
  setTimeout(updateBookmark, 100);
});

home?.addEventListener('click', () => {
  const frame = getActiveFrame();
  if (!frame) return;
  frame.src = './new';
  frame.addEventListener('load', updateBookmark, { once: true });
});

favorite?.addEventListener('click', async () => {
  if (!urlbar) return;

  const frame = getActiveFrame();
  if (!frame || nativePaths[urlbar.value]) return;

  let src = frame.src;
  try {
    const urlObj = new URL(src, window.location.origin);
    let path = urlObj.pathname;
    if (path.startsWith(scramjetInstance.prefix)) {
      path = path.slice(scramjetInstance.prefix.length);
    }
    src = path;
  } catch {}
  const url = scramjetInstance.codec.decode(src);
  const name = frame.contentDocument?.title || url;

  let domain: string;
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url;
  }

  const currentBm = ((await ConfigAPI.get('bm')) ?? []) as Array<{ name: string; logo: string; redir: string }>;

  function normalize(u: string) {
    try {
      return decodeURIComponent(u).replace(/\/$/, '');
    } catch {
      return u.replace(/\/$/, '');
    }
  }

  const normUrl = normalize(url);
  const existingIndex = currentBm.findIndex(b => normalize(b.redir) === normUrl);

  if (existingIndex !== -1) {
    currentBm.splice(existingIndex, 1);
    const svg = favorite.querySelector('svg');
    if (svg) {
      svg.style.fill = 'none';
      svg.style.stroke = '';
    }
  } else {
    currentBm.push({
      name,
      logo: `/api/icon/?url=https://${domain}`,
      redir: url,
    });
    const svg = favorite.querySelector('svg');
    if (svg) {
      svg.style.fill = '#a8a3c7';
      svg.style.stroke = '#a8a3c7';
    }
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

  if (!url) return;
  loading();
  frame.src = url;
  frame.addEventListener('load', updateBookmark, { once: true });
});

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

targetDoc?.querySelectorAll<HTMLElement>('aside button, aside img').forEach(el => {
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
    frame.addEventListener('load', updateBookmark, { once: true });
  });
});

TabManager.onUrlChange(() => {
  updateBookmark();
});
