import { Settings } from '@src/utils/config';

const bak = document.getElementById('back') as HTMLButtonElement;
const fwd = document.getElementById('forward') as HTMLButtonElement;
const refresh = document.getElementById('reload') as HTMLButtonElement;
const starting = document.getElementById('starting') as HTMLDivElement;
const frame = document.getElementById('frame') as HTMLIFrameElement;
const ff = document.getElementById('full-screen') as HTMLButtonElement;
const cnsl = document.getElementById('console') as HTMLButtonElement;
const star = document.getElementById('fav') as HTMLButtonElement;
const copy = document.getElementById('link') as HTMLButtonElement;
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
      console.debug('Navigating to ' + path);
      if (frame) frame.src = path as string;
    });
  }
});

if (copy) {
  copy.addEventListener('click', async () => {
    const FrameUrl = new URL(frame.contentWindow!.location.href);
    const pathname = FrameUrl.pathname;

    try {
      if (!frame || !frame.src || frame.src === 'about:blank') {
        console.log('Cannot copy URL without a valid source.');
        return;
      }
    } catch (e) {
      console.error('Error copying URL:', e);
    }

    if (!pathname.startsWith('/p/') && !pathname.startsWith('/scram/')) {
      await navigator.clipboard.writeText(frame.contentWindow!.location.href);
      alert('URL copied to clipboard!');
      return;
    }

    try {
      const backend = await Settings.get('backend');
      let url;

      if (backend === 'uv') {
        url = UltraConfig.decodeUrl(
          frame.contentWindow!.location.href.split('/p/')[1] ||
            frame.contentWindow!.location.href
        );
      } else {
        url = scram.decodeUrl(
          frame.contentWindow!.location.href.split('/scram/')[1] ||
            frame.contentWindow!.location.href
        );
      }

      url = url || frame.src;

      await navigator.clipboard.writeText(url);
      alert('URL copied to clipboard!');
    } catch (error) {
      console.error('Error fetching backend from settings:', error);
    }
  });
}

if (cnsl) {
  cnsl.addEventListener('click', () => {
    try {
      if (!frame || !frame.src || frame.src === 'about:blank') {
        console.log('Cannot copy URL without a valid source.');
        return;
      }
    } catch (e) {
      console.error('Error copying URL:', e);
    }
    const eruda = frame.contentWindow?.eruda;
    if (eruda) {
      if (eruda._isInit) {
        eruda.destroy();
        console.debug('Eruda console destroyed.');
        return;
      } else {
        console.debug('Eruda console is not initialized.');
      }
    } else {
      console.debug('Eruda console not loaded yet.');
    }

    if (!eruda || !eruda._isInit) {
      if (frame.contentDocument) {
        var script = frame.contentDocument.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/eruda';
        script.onload = function () {
          frame.contentWindow?.eruda.init();
          frame.contentWindow?.eruda.show();
          console.debug('Eruda console initialized.');
        };
        frame.contentDocument.head.appendChild(script);
      } else {
        throw new Error('Cannot inject script.');
      }
    }
  });
}

if (ff) {
  ff.addEventListener('click', () => {
    if (frame && frame.src) {
      frame.requestFullscreen();
    } else {
      console.log('Cannot go fullscreen without a valid source.');
    }
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
      const nickname = prompt('Enter a nickname for this favorite:');
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
          console.debug(`Favorite "${nickname}" added successfully!`);
        } catch (error) {
          console.error('Error adding favorite:', error);
        }
      } else {
        alert('Favorite not saved. Nickname is required.');
      }
    } else {
      throw new Error('Cannot favorite an invalid page');
    }
  });
}
