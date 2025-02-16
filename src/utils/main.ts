import { BareMuxConnection } from '@mercuryworkshop/bare-mux';
import { Settings } from '@src/utils/config';
import { Search } from './search';

const copy = document.getElementById('link') as HTMLButtonElement;
const input = document.getElementById('input') as HTMLInputElement;
const fm = document.getElementById('form') as HTMLFormElement;
const favicon = document.getElementById('favicon') as HTMLImageElement;
const frame = document.getElementById('frame') as HTMLIFrameElement;
const clear = document.getElementById('clear') as HTMLButtonElement;
const si = document.getElementById('startSearch') as HTMLInputElement;
const sbtn = document.getElementById('searchBtn') as HTMLButtonElement;
const sf = document.getElementById('startForm') as HTMLFormElement;
const loading = document.getElementById('loading') as HTMLDivElement;
const welcome = document.getElementById('starting') as HTMLDivElement;
const startclear = document.getElementById('sclear') as HTMLButtonElement;
const connection = new BareMuxConnection('/assets/packaged/bm/worker.js');
const wispurl =
  (location.protocol === 'https:' ? 'wss' : 'ws') +
  '://' +
  location.host +
  '/wsp/';
const scram = new ScramjetController({
  prefix: '/scram/',
  files: {
    wasm: '/assets/packaged/scram/wasm.js',
    worker: '/assets/packaged/scram/worker.js',
    client: '/assets/packaged/scram/client.js',
    shared: '/assets/packaged/scram/shared.js',
    sync: '/assets/packaged/scram/sync.js',
  },
  defaultFlags: { serviceworkers: true },
});
window.sj = scram;
scram.init();

try {
  await navigator.serviceWorker.register('/sw.js').then(() => {
    console.log('[DEBUG] Service Workers are registered.');
  });
} catch (error) {
  throw new Error(
    '[DEBUG] Service Worker registration failed with error:' + error
  );
}

document.addEventListener('DOMContentLoaded', async () => {
  // todo - make it switchable epoxy & libcurl
  if ((await connection.getTransport()) !== '/assets/packaged/ep/index.mjs') {
    await connection.setTransport('/assets/packaged/ep/index.mjs', [
      { wisp: wispurl },
    ]);
  }
});

async function launch(link: string) {
  const backend: string = await Settings.get('backend');
  if ((await connection.getTransport()) !== '/assets/packaged/ep/index.mjs') {
    await connection.setTransport('/assets/packaged/ep/index.mjs', [
      { wisp: wispurl },
    ]);
  }
  console.log('[DEBUG] Transport set to Epoxy');
  const url = (await Search(link)) || 'd';
  if (backend == 'uv') {
    frame.src = `/p/${UltraConfig.encodeUrl(url) ?? 'ERROR'}`;
  } else {
    frame.src = scram.encodeUrl(url);
  }
  console.log(`[DEBUG] URL set to ${frame.src}`);
  frame.addEventListener('load', () => {
    const frameWindow = frame.contentWindow;

    let path = new URL(frameWindow!.location.href).pathname;
    if (!path.startsWith('/p/') && !path.startsWith('/scram/')) {
      return;
    }
    const isUV = backend === 'uv';
    const decodedUrl = isUV
      ? UltraConfig.decodeUrl(
          new URL(frameWindow!.location.href).pathname.replace(/^\/p\//, '')
        )
      : scram.decodeUrl(
          new URL(frameWindow!.location.href).pathname.replace(/^\/scram\//, '')
        );

    if (isUV) InterceptLinks();
    input.value = decodedUrl || '';
    favicon.src = `https://s2.googleusercontent.com/s2/favicons?sz=64&domain_url=${decodedUrl}`;
    copy.style.right = '40px';
    clear.style.right = '10px';
    clear.classList.remove('hidden');
  });
}

fm.addEventListener('submit', async (event) => {
  event.preventDefault();
  welcome.classList.add('hidden');
  loading.classList.remove('hidden');
  if (input.value.startsWith('lunar://')) {
    LunarPaths(input.value.trim());
    return;
  }
  const value = input.value.trim();
  launch(value);
});

sbtn.addEventListener('click', async (event) => {
  event.preventDefault();
  fm.dispatchEvent(new Event('submit'));
});

sf.addEventListener('submit', async (event) => {
  event.preventDefault();
  input.value = si.value;
  fm.dispatchEvent(new Event('submit'));
});

async function InterceptLinks() {
  console.log('[DEBUG] Intercepting links is running...');
  const clickableElements =
    frame.contentWindow?.document.querySelectorAll<HTMLElement>(
      'a, button, [role="button"], [onclick], [data-href], span'
    );

  if (clickableElements) {
    clickableElements.forEach((element) => {
      element.addEventListener('click', (event) => {
        const target = event.currentTarget as HTMLElement;
        let href: string | null = null;
        if (target instanceof HTMLAnchorElement) {
          href = target.href;
        } else if (target.dataset.href) {
          href = target.dataset.href;
        } else if (target.hasAttribute('onclick')) {
          const onclickContent = target.getAttribute('onclick');
          const match = onclickContent?.match(
            /(?:location\.href\s*=\s*['"])([^'"]+)(['"])/
          );
          href = match?.[1] || null;
        } else if (target.closest('a')) {
          href = target.closest('a')?.href || null;
        }

        if (href) {
          event.preventDefault();
          console.debug('[DEBUG] Redirected URL:', href);
          launch(href);
        }
      });
    });
  }
}

sf.addEventListener('submit', async (event) => {
  event.preventDefault();
  input.value = si.value;
  fm.dispatchEvent(new Event('submit'));
});

startclear?.addEventListener('click', () => {
  si.value = '';
  startclear.classList.add('hidden');
  si.focus();
});

si?.addEventListener('input', function () {
  if (this.value.length >= 1) {
    startclear.classList.remove('hidden');
  } else {
    startclear.classList.add('hidden');
  }
});

function LunarPaths(path: string) {
  if (path == 'lunar://apps') {
    input.value = 'lunar://apps';
    frame.src = './ap';
    copy.style.right = '40px';
    clear.style.right = '10px';
    clear.classList.remove('hidden');
  } else if (path == 'lunar://games') {
    frame.src = './gm';
    input.value = 'lunar://games';
    copy.style.right = '40px';
    clear.style.right = '10px';
    clear.classList.remove('hidden');
  } else if (path == 'lunar://settings') {
    frame.src = './s';
    input.value = 'lunar://settings';
    copy.style.right = '40px';
    clear.style.right = '10px';
    clear.classList.remove('hidden');
  } else {
    throw new Error('[ERROR] Invalid Path');
  }
}

window.history.replaceState?.('', '', window.location.href); // This prevents the are you sure you want to reload prompt
