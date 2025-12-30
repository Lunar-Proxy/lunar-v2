  import ConfigAPI from '../utils/config';
  import * as baremux from '@mercuryworkshop/bare-mux';
  import { createIcons, icons } from 'lucide';

  interface Bookmark {
    name: string;
    redir: string;
  }

  const moonIcon = '/a/moon.svg';
  const FAVICON_API =
    'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64';
  const iconApi = FAVICON_API + '&url=';

  const connection = new baremux.BareMuxConnection('/bm/worker.js');
  const client = new baremux.BareClient();

  let container: HTMLDivElement | null = null;
  let bookmarks: Bookmark[] = [];
  let rendering = false;

  function toBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  async function getIcon(url: string): Promise<string> {
    if (!url) return moonIcon;
    try {
      const res = await fetch(iconApi + encodeURIComponent(url));
      if (res.ok) {
        return await toBase64(await res.blob());
      }
    } catch {}
    try {
      const res = await client.fetch(iconApi + encodeURIComponent(url));
      if (!res.ok) throw 0;
      return await toBase64(await res.blob());
    } catch {
      return moonIcon;
    }
  }

  async function render() {
    if (!container || rendering) return;
    rendering = true;

    container.innerHTML = '';

    const wispRaw = await ConfigAPI.get('wispUrl');
    const wisp = typeof wispRaw === 'string' ? wispRaw : '';

    if (await connection.getTransport() !== '/lc/index.mjs') {
      await connection.setTransport('/lc/index.mjs', [{ wisp }]);
    }

    const iconsSrc = await Promise.all(
      bookmarks.map(b => getIcon(b.redir))
    );

    bookmarks.forEach((bm, i) => {
      const div = document.createElement('div');
      div.className =
        'shortcut-card relative flex flex-col items-center justify-center space-y-3 rounded-2xl bg-background-overlay/80 border border-border-default/20 p-5 min-w-[120px] max-w-[160px] transition-all duration-200 hover:scale-105 cursor-pointer group backdrop-blur-md shadow-lg';

      div.innerHTML = `
        <div class="absolute -top-2 -right-2 flex z-10 opacity-0 group-hover:opacity-100 transition-all">
          <button class="delete bg-red-500/70 hover:bg-red-600 rounded-full p-1.5">
            <i data-lucide="trash-2" class="h-3 w-3 text-white"></i>
          </button>
        </div>
        <div class="w-16 h-16 rounded-xl bg-background-overlay/90 border border-border-default/20 flex items-center justify-center overflow-hidden">
          <img src="${iconsSrc[i]}" class="w-10 h-10 object-contain" />
        </div>
        <p class="text-base font-semibold text-text-header max-w-[120px] break-words text-center">
          ${bm.name}
        </p>
      `;

      div.querySelector('.delete')?.addEventListener('click', async e => {
        e.stopPropagation();
        bookmarks.splice(i, 1);
        await ConfigAPI.set('bm', bookmarks);
        render();
      });

      div.addEventListener('click', () => {
        const input = window.parent.document.getElementById('urlbar') as HTMLInputElement | null;
        if (!input) return;
        input.value = bm.redir;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      });

      container!.appendChild(div);
    });

    createIcons({ icons });
    rendering = false;
  }

  async function init() {
    await ConfigAPI.init();

    container = document.getElementById('shortcuts') as HTMLDivElement | null;
    if (!container) return;

    const raw = await ConfigAPI.get('bm');
    bookmarks = Array.isArray(raw)
      ? raw.map(b => ({ name: String(b.name), redir: String(b.redir ?? '') }))
      : [];

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
