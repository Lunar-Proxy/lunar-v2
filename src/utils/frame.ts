import { BareMuxConnection } from '@mercuryworkshop/bare-mux';
import { Settings } from '@src/utils/config';

const exit = document.getElementById('return') as HTMLButtonElement;
const refresh = document.getElementById('rotate') as HTMLButtonElement;
const frame = document.getElementById('display') as HTMLIFrameElement;
const full = document.getElementById('maximize') as HTMLButtonElement;
const launch = document.getElementById('game-frame') as HTMLDivElement;
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

export async function launch2(link: string) {
  const connection = new BareMuxConnection('/assets/packaged/bm/worker.js');
  const wispurl =
    (location.protocol === 'https:' ? 'wss' : 'ws') +
    '://' +
    location.host +
    '/wsp/';
  const backend = await Settings.get('backend');
  if ((await connection.getTransport()) !== '/assets/packaged/ep/index.mjs') {
    await connection.setTransport('/assets/packaged/ep/index.mjs', [
      { wisp: wispurl },
    ]);
  }
  console.log('[DEBUG] Transport set to Epoxy');
  launch.classList.remove('hidden');
  let url;
  if (backend === 'uv') url = `/p/${UltraConfig.encodeUrl(link)}`;
  if (backend === 'sj') url = scram.encodeUrl(link);
  frame.src = url;

  frame.addEventListener('load', () => {
    if (backend == 'uv') {
      InterceptLinks();
    }
  });
}

exit.addEventListener('click', () => {
  frame.src = 'about:blank';
  launch.classList.add('hidden');
});

refresh.addEventListener('click', () => {
  frame.contentWindow!.location.reload();
});

full.addEventListener('click', () => {
  frame.requestFullscreen();
});

async function InterceptLinks() {
  console.debug('[DEBUG] Intercepting links....');
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
          launch2(href);
        }
      });
    });
  }
}
