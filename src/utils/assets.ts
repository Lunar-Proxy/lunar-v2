import ConfigAPI from './config';

document.addEventListener('DOMContentLoaded', async () => {
  // @ts-ignore
  const { ScramjetController } = $scramjetLoadController();
  const sc = new ScramjetController({
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

  await sc.init();

  const conn = new BareMux.BareMuxConnection('/bm/worker.js');
  const input = document.querySelector<HTMLInputElement>('[data-input]');
  const box = document.querySelector<HTMLDivElement>('[data-container]');
  const empty = document.querySelector<HTMLDivElement>('[data-empty]');
  const randBtn = document.querySelector<HTMLButtonElement>('[data-random]');
  const sortBtn = document.querySelector<HTMLButtonElement>('[data-sort]');
  const clrBtn = document.querySelector<HTMLButtonElement>('[data-clear]');
  const grid = document.querySelector<HTMLButtonElement>('[data-view="grid"]');
  const list = document.querySelector<HTMLButtonElement>('[data-view="list"]');
  const compact = document.querySelector<HTMLButtonElement>('[data-view="compact"]');
  const count = document.querySelector<HTMLSpanElement>('[data-visible]');
  const wisp = await ConfigAPI.get('wispUrl');

  if (!input || !box || !randBtn) return;

  const items = Array.from(box.querySelectorAll<HTMLDivElement>('.card'));
  const data = items.map(el => ({
    el,
    n: el.querySelector('h2')?.textContent?.toLowerCase() ?? '',
    d: el.querySelector('p')?.textContent?.toLowerCase() ?? '',
    bg: el.dataset.bg,
    sn: el.dataset.name?.toLowerCase() ?? '',
  })).sort((a, b) => a.sn.localeCompare(b.sn));

  const frag = document.createDocumentFragment();
  data.forEach(({ el }) => frag.appendChild(el));
  box.appendChild(frag);

  let rev = false;

  data.forEach(({ el, bg }) => {
    if (!bg) return;
    const img = new Image();
    img.onload = () => {
      el.classList.remove('card-loading');
      const div = el.querySelector('.card-bg') as HTMLElement;
      if (div) div.style.backgroundImage = `url('${bg}')`;
    };
    img.onerror = () => el.classList.remove('card-loading');
    img.src = bg;
  });

  const upd = () => {
    const vis = data.filter(({ el }) => el.style.display !== 'none').length;
    if (count) count.textContent = vis.toString();
    const show = vis === 0 && input.value.trim() !== '';
    empty?.classList.toggle('hidden', !show);
    empty?.classList.toggle('flex', show);
  };

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    data.forEach(({ el, n, d }) => {
      el.style.display = n.includes(q) || d.includes(q) ? '' : 'none';
    });
    upd();
  });

  randBtn.addEventListener('click', () => {
    const vis = data.filter(({ el }) => el.style.display !== 'none');
    if (vis.length) vis[Math.floor(Math.random() * vis.length)].el.click();
  });

  sortBtn?.addEventListener('click', () => {
    rev = !rev;
    const sorted = [...data].sort((a, b) => rev ? b.sn.localeCompare(a.sn) : a.sn.localeCompare(b.sn));
    const txt = sortBtn.querySelector('span');
    if (txt) txt.textContent = rev ? 'Z-A' : 'A-Z';
    const f = document.createDocumentFragment();
    sorted.forEach(({ el }) => f.appendChild(el));
    box.appendChild(f);
  });

  clrBtn?.addEventListener('click', () => {
    input.value = '';
    data.forEach(({ el }) => (el.style.display = ''));
    upd();
  });

  const setBtn = (btn: HTMLButtonElement) => {
    [grid, list, compact].forEach(b => {
      b?.classList.remove('bg-background', 'text-text-header');
      b?.classList.add('text-text-secondary');
    });
    btn.classList.add('bg-background', 'text-text-header');
    btn.classList.remove('text-text-secondary');
  };

  const resetH = () => {
    data.forEach(({ el }) => {
      el.classList.remove('h-32', 'h-36', 'h-44');
      const p = el.querySelector('p') as HTMLElement;
      if (p) p.style.display = '';
    });
  };

  grid?.addEventListener('click', () => {
    if (!box) return;
    resetH();
    box.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';
    data.forEach(({ el }) => el.classList.add('h-44'));
    setBtn(grid);
  });

  list?.addEventListener('click', () => {
    if (!box) return;
    resetH();
    box.className = 'flex flex-col gap-4';
    data.forEach(({ el }) => el.classList.add('h-36'));
    setBtn(list);
  });

  compact?.addEventListener('click', () => {
    if (!box) return;
    resetH();
    box.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3';
    data.forEach(({ el }) => {
      el.classList.add('h-32');
      const p = el.querySelector('p') as HTMLElement;
      if (p) p.style.display = 'none';
    });
    setBtn(compact);
  });

  data.forEach(({ el }) => {
    el.addEventListener('click', async () => {
      const url = el.getAttribute('data-href');
      if (!url) return;
      if ((await conn.getTransport()) !== '/lc/index.mjs') {
        await conn.setTransport('/lc/index.mjs', [{ wisp }]);
      }
      window.location.href = sc.encodeUrl(url);
    });
  });

  upd();
});

