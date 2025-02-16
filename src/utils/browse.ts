import { Settings } from '@src/utils/config';

const bak = document.getElementById('back') as HTMLButtonElement;
const fwd = document.getElementById('forward') as HTMLButtonElement;
const refresh = document.getElementById('reload') as HTMLButtonElement;
const starting = document.getElementById('starting') as HTMLDivElement;
const frame = document.getElementById('frame') as HTMLIFrameElement;
const ff = document.getElementById('full-screen') as HTMLButtonElement;
const clear = document.getElementById('clear') as HTMLButtonElement;
const cnsl = document.getElementById('console') as HTMLButtonElement;
const star = document.getElementById('fav') as HTMLButtonElement;
const copy = document.getElementById('link') as HTMLButtonElement;
const input = document.getElementById('input') as HTMLInputElement;
const scram = new ScramjetController({
  prefix: '/scram/',
  files: {
    wasm: '/assets/sj/wasm.js',
    worker: '/assets/sj/worker.js',
    client: '/assets/sj/client.js',
    shared: '/assets/sj/shared.js',
    sync: '/assets/sj/sync.js',
  },
  defaultFlags: {
    serviceworkers: true,
  },
});
window.sj = scram;

type PageElement = {
  [key: string]: string;
};

const elements: PageElement = {
  ap: './ap',
  gam: './gm',
  gear: './s',
};

Object.entries(elements).forEach(([key, path]) => {
  const element = document.getElementById(key);
  if (element) {
    element.addEventListener('click', () => {
      starting.classList.add('hidden');
      console.debug('[DEBUG] Navigating to ' + path);
      if (frame) frame.src = path as string;
      if (path === './ap') {
        input.value = 'lunar://apps';
        copy.style.right = '40px';
        clear.style.right = '10px';
        clear.classList.remove('hidden');
      } else if (path === './gm') {
        input.value = 'lunar://games';

        copy.style.right = '40px';
        clear.style.right = '10px';
        clear.classList.remove('hidden');
      } else if (path) {
        input.value = 'lunar://settings';

        copy.style.right = '40px';
        clear.style.right = '10px';
        clear.classList.remove('hidden');
      }
    });
  }
});

if (copy) {
  copy.addEventListener('click', async () => {
    const frameWindow = frame.contentWindow;
    let FrameUrl = new URL(frameWindow!.location.href);
    let path = FrameUrl.pathname as '/gm' | '/ap' | '/s' | string;

    if (!path.startsWith('/p/') && !path.startsWith('/scram/')) {
      try {
        const clipboardMap: Record<'/gm' | '/ap' | '/s', string> = {
          '/gm': 'lunar://games',
          '/ap': 'lunar://apps',
          '/s': 'lunar://settings',
        };

        if (clipboardMap[path as '/gm' | '/ap' | '/s']) {
          await navigator.clipboard.writeText(
            clipboardMap[path as '/gm' | '/ap' | '/s']
          );
          console.log(
            `[DEBUG] Copied: ${clipboardMap[path as '/gm' | '/ap' | '/s']}`
          );
        } else {
          console.warn('[DEBUG] No matching path.');
        }
      } catch (err) {
        console.error('[ERROR] Failed to copy to clipboard:', err);
      }
    } else {
      let href = frameWindow?.location.href;
      const backend = await Settings.get('backend');
      if (backend == 'uv') {
        const decodedUrl = UltraConfig.decodeUrl(
          href ? new URL(href).pathname.replace(/^\/p\//, '') : '/'
        );
        await navigator.clipboard.writeText(decodedUrl!);
        console.log(decodedUrl);
      } else {
        const decodedUrl = scram.decodeUrl(
          href ? new URL(href).pathname.replace(/^\/scram\//, '') : '/'
        );
        await navigator.clipboard.writeText(decodedUrl);
        console.log(decodedUrl);
      }
    }
  });
}

if (cnsl) {
  cnsl.addEventListener('click', () => {
    try {
      if (!frame || !frame.src || frame.src === 'about:blank') {
        console.log('[ERROR] Cannot copy URL without a valid source.');
        return;
      }
    } catch (e) {
      console.error('[ERROR] Error copying URL:', e);
    }
    const eruda = frame.contentWindow?.eruda;
    if (eruda) {
      if (eruda._isInit) {
        eruda.destroy();
        console.debug('[DEBUG] Eruda console destroyed.');
        return;
      } else {
        console.debug('[DEBUG] Eruda console is not initialized.');
      }
    } else {
      console.debug('[DEBUG] Eruda console not loaded yet.');
    }

    if (!eruda || !eruda._isInit) {
      if (frame.contentDocument) {
        var script = frame.contentDocument.createElement('script');
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
    }
  });
}

if (ff) {
  ff.addEventListener('click', () => {
    frame.requestFullscreen();
  });
}

if (bak) {
  bak.addEventListener('click', () => {
    frame.contentWindow!.history.forward();
  });
}

if (fwd) {
  fwd.addEventListener('click', () => {
    frame.contentWindow!.history.back();
  });
}

if (refresh) {
  refresh.addEventListener('click', () => {
    frame.contentWindow!.location.reload();
  });
}

if (star) {
  star.addEventListener('click', async () => {
    let originalUrl;
    if (frame && frame.src) {
      let nickname = '123';
      alert('Coming soon!');
      // const nickname = prompt('Enter a nickname for this favorite:');
      if (nickname) {
        const favorites = JSON.parse(
          localStorage.getItem('@lunar/favorites') || '[]'
        );
        try {
          if ((await Settings.get('backend')) == 'sj') {
            originalUrl = `${scram.decodeUrl(frame.contentWindow!.location.href.split('/scram/')[1] || frame.contentWindow!.location.href)}`;
          } else {
            originalUrl = `${UltraConfig.decodeUrl(frame.contentWindow!.location.href.split('/p/')[1] || frame.contentWindow!.location.href)}`;
          }
          const newFav = { nickname, url: originalUrl };
          favorites.push(newFav);
          localStorage.setItem('@lunar/favorites', JSON.stringify(favorites));
          console.debug(`[DEBUG] Favorite "${nickname}" added successfully!`);
        } catch (error) {
          throw new Error('[ERROR] Error adding favorite:' + error);
        }
      } else {
        alert('[ERROR] Favorite not saved. Nickname is required.');
      }
    } else {
      throw new Error('[ERROR] Cannot favorite an invalid page');
    }
  });
}

input?.addEventListener('input', function () {
  if (this.value.length >= 1) {
    copy.style.right = '40px';
    clear.style.right = '10px';
    clear.classList.remove('hidden');
  } else {
    clear.classList.add('hidden');
    copy.style.right = '10px';
  }
});

clear?.addEventListener('click', () => {
  input.value = '';
  clear.classList.add('hidden');
  copy.style.right = '10px';
  input.focus();
});
