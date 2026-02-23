import ConfigAPI from './config';
import { scramjetWrapper, vWrapper } from './pro';

type CardItem = {
  el: HTMLDivElement;
  n: string;
  d: string;
  sn: string;
};

document.addEventListener('DOMContentLoaded', async () => {
  scramjetWrapper.init();
  const sc = scramjetWrapper.getConfig();
  const conn = new BareMux.BareMuxConnection(`/bm/worker.js`);
  const input = document.querySelector<HTMLInputElement>('[data-input]');
  const box = document.querySelector<HTMLDivElement>('[data-container]');
  const empty = document.querySelector<HTMLDivElement>('[data-empty]');
  const count = document.querySelector<HTMLSpanElement>('[data-visible]');
  const wisp = await ConfigAPI.get('wispUrl');

  if (!input || !box) return;

  const items: CardItem[] = Array.from(box.querySelectorAll<HTMLDivElement>('.card')).map(el => ({
    el,
    n: el.querySelector('h2')?.textContent?.toLowerCase() || '',
    d: el.querySelector('p')?.textContent?.toLowerCase() || '',
    sn: el.dataset.name?.toLowerCase() || '',
  }));

  const loadImages = () => {
    const visible = items.filter(({ el }) => {
      const rect = el.getBoundingClientRect();
      return rect.top < window.innerHeight + 200 && rect.bottom > -200;
    });

    visible.forEach(({ el }) => {
      if (el.classList.contains('card-loading')) {
        const bg = el.dataset.bg;
        if (!bg) return;
        const div = el.querySelector<HTMLElement>('.card-bg');
        if (div && !div.style.backgroundImage) {
          div.style.backgroundImage = `url('${bg}')`;
          const img = new Image();
          img.onload = () => el.classList.remove('card-loading');
          img.onerror = () => el.classList.remove('card-loading');
          img.src = bg;
        }
      }
    });
  };

  let loadTimer: number;
  const scheduleLoad = () => {
    clearTimeout(loadTimer);
    loadTimer = window.setTimeout(loadImages, 50);
  };

  loadImages();
  window.addEventListener('scroll', scheduleLoad, { passive: true });
  window.addEventListener('resize', scheduleLoad, { passive: true });

  const update = (): void => {
    const vis = items.filter(({ el }) => el.style.display !== 'none').length;
    if (count) count.textContent = String(vis);
    const show = vis === 0 && input && input.value.trim() !== '';
    empty?.classList.toggle('hidden', !show);
    empty?.classList.toggle('flex', !!show);
    scheduleLoad();
  };

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    items.forEach(({ el, n, d }) => {
      el.style.display = n.includes(q) || d.includes(q) ? '' : 'none';
    });
    update();
  });

  document.querySelector<HTMLButtonElement>('[data-random]')?.addEventListener('click', () => {
    const vis = items.filter(({ el }) => el.style.display !== 'none');
    if (vis.length) vis[Math.floor(Math.random() * vis.length)].el.click();
  });

  let rev = false;
  document.querySelector<HTMLButtonElement>('[data-sort]')?.addEventListener('click', function () {
    rev = !rev;
    items.sort((a, b) => (rev ? b.sn.localeCompare(a.sn) : a.sn.localeCompare(b.sn)));
    this.querySelector('span')!.textContent = rev ? 'Z-A' : 'A-Z';
    items.forEach(({ el }) => box.appendChild(el));
    scheduleLoad();
  });

  document.querySelector<HTMLButtonElement>('[data-clear]')?.addEventListener('click', () => {
    input.value = '';
    items.forEach(({ el }) => (el.style.display = ''));
    update();
  });

  const views = ['grid', 'compact', 'list'] as const;
  const btns = views.map(v => document.querySelector<HTMLButtonElement>(`[data-view="${v}"]`));

  const setActive = (btn: HTMLButtonElement) => {
    btns.forEach(b => {
      if (!b) return;
      b.classList.remove('bg-[#252537]/60', 'text-white/70');
      b.classList.add('text-white/50');
    });
    btn.classList.remove('text-white/50');
    btn.classList.add('bg-[#252537]/60', 'text-white/70');
  };

  btns[0]?.addEventListener('click', function () {
    items.forEach(({ el }) => {
      el.classList.remove('h-32', 'h-36');
      el.classList.add('h-40');
      const p = el.querySelector<HTMLElement>('p');
      if (p) p.style.display = '';
    });
    box.className = 'grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
    setActive(this);
    scheduleLoad();
  });

  btns[1]?.addEventListener('click', function () {
    items.forEach(({ el }) => {
      el.classList.remove('h-32', 'h-40');
      el.classList.add('h-32');
      const p = el.querySelector<HTMLElement>('p');
      if (p) p.style.display = 'none';
    });
    box.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3';
    setActive(this);
    scheduleLoad();
  });

  btns[2]?.addEventListener('click', function () {
    items.forEach(({ el }) => {
      el.classList.remove('h-32', 'h-40');
      el.classList.add('h-36');
      const p = el.querySelector<HTMLElement>('p');
      if (p) p.style.display = '';
    });
    box.className = 'flex flex-col gap-3';
    setActive(this);
    scheduleLoad();
  });

  items.forEach(({ el }) => {
    el.addEventListener('click', async () => {
      const url = el.dataset.href;
      if (!url) return;

      if ((await conn.getTransport()) !== `/lc/index.mjs`) {
        await conn.setTransport(`/lc/index.mjs`, [{ wisp }]);
      }

      const backend = await ConfigAPI.get('backend');
      const encoded = sc.codec.encode(url);
      const targetUrl =
        backend === 'v' ? vWrapper.getConfig().prefix + encoded : sc.prefix + encoded;

      window.location.href = targetUrl;
    });
  });

  update();
});
