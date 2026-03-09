import ConfigAPI from './config';
import { scramjetWrapper, vWrapper } from './pro';

type Card = {
  el: HTMLDivElement;
  name: string;
  desc: string;
  sortKey: string;
};

document.addEventListener('DOMContentLoaded', async () => {
  await scramjetWrapper.init();
  const sj = scramjetWrapper.getConfig();
  const bare = new BareMux.BareMuxConnection('/bm/worker.js');
  const search = document.querySelector<HTMLInputElement>('[data-input]');
  const grid = document.querySelector<HTMLDivElement>('[data-container]');
  const empty = document.querySelector<HTMLDivElement>('[data-empty]');
  const counter = document.querySelector<HTMLSpanElement>('[data-visible]');
  const wisp = await ConfigAPI.get('wispUrl');

  if (!search || !grid) return;

  const cardElements = Array.from(document.querySelectorAll<HTMLDivElement>('.card'));
  const cards: Card[] = cardElements.map(el => ({
    el,
    name: (el.dataset.name ?? el.querySelector('h2')?.textContent ?? '').toLowerCase(),
    desc: (el.querySelector('p')?.textContent ?? '').toLowerCase(),
    sortKey: (el.dataset.name ?? '').toLowerCase(),
  }));

  let imgTimer: number;

  const loadImgs = () => {
    for (const { el } of cards) {
      if (!el.classList.contains('card-loading')) continue;
      const { top, bottom } = el.getBoundingClientRect();
      if (top > window.innerHeight + 200 || bottom < -200) continue;
      const bg = el.dataset.bg;
      if (!bg) continue;
      const bgDiv = el.querySelector<HTMLElement>('.card-bg');
      if (!bgDiv || bgDiv.style.backgroundImage) continue;
      bgDiv.style.backgroundImage = `url('${bg}')`;
      const img = new Image();
      img.onload = img.onerror = () => el.classList.remove('card-loading');
      img.src = bg;
    }
  };

  const queueImgs = () => {
    clearTimeout(imgTimer);
    imgTimer = window.setTimeout(loadImgs, 50);
  };

  loadImgs();
  window.addEventListener('scroll', queueImgs, { passive: true });
  window.addEventListener('resize', queueImgs, { passive: true });

  const refresh = () => {
    const shown = cards.filter(({ el }) => el.style.display !== 'none').length;
    if (counter) counter.textContent = String(shown);
    const noResults = shown === 0 && search.value.trim() !== '';
    empty?.classList.toggle('hidden', !noResults);
    empty?.classList.toggle('flex', noResults);
    queueImgs();
  };

  search.addEventListener('input', () => {
    const q = search.value.toLowerCase().trim();
    for (const { el, name, desc } of cards)
      el.style.display = name.includes(q) || desc.includes(q) ? '' : 'none';
    refresh();
  });

  document.querySelector<HTMLButtonElement>('[data-random]')?.addEventListener('click', () => {
    const pool = cards.filter(({ el }) => el.style.display !== 'none');
    if (pool.length) pool[Math.floor(Math.random() * pool.length)].el.click();
  });

  let flipped = false;
  document.querySelector<HTMLButtonElement>('[data-sort]')?.addEventListener('click', function () {
    flipped = !flipped;
    cards.sort((a, b) =>
      flipped ? b.sortKey.localeCompare(a.sortKey) : a.sortKey.localeCompare(b.sortKey)
    );
    this.querySelector('span')!.textContent = flipped ? 'Z-A' : 'A-Z';
    for (const { el } of cards) grid.appendChild(el);
    queueImgs();
  });

  document.querySelector<HTMLButtonElement>('[data-clear]')?.addEventListener('click', () => {
    search.value = '';
    for (const { el } of cards) el.style.display = '';
    refresh();
  });

  const setView = (active: HTMLButtonElement) => {
    for (const v of ['grid', 'compact', 'list']) {
      const btn = document.querySelector<HTMLButtonElement>(`[data-view="${v}"]`);
      if (!btn) continue;
      btn.classList.toggle('bg-[#252537]/60', btn === active);
      btn.classList.toggle('text-white/70', btn === active);
      btn.classList.toggle('text-white/50', btn !== active);
    }
  };

  document
    .querySelector<HTMLButtonElement>('[data-view="grid"]')
    ?.addEventListener('click', function () {
      for (const { el } of cards) {
        el.classList.replace('h-32', 'h-40') ||
          el.classList.replace('h-36', 'h-40') ||
          el.classList.add('h-40');
        const p = el.querySelector<HTMLElement>('p');
        if (p) p.style.display = '';
      }
      grid.className = 'grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
      setView(this);
      queueImgs();
    });

  document
    .querySelector<HTMLButtonElement>('[data-view="compact"]')
    ?.addEventListener('click', function () {
      for (const { el } of cards) {
        el.classList.replace('h-40', 'h-32') ||
          el.classList.replace('h-36', 'h-32') ||
          el.classList.add('h-32');
        const p = el.querySelector<HTMLElement>('p');
        if (p) p.style.display = 'none';
      }
      grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3';
      setView(this);
      queueImgs();
    });

  document
    .querySelector<HTMLButtonElement>('[data-view="list"]')
    ?.addEventListener('click', function () {
      for (const { el } of cards) {
        el.classList.replace('h-40', 'h-36') ||
          el.classList.replace('h-32', 'h-36') ||
          el.classList.add('h-36');
        const p = el.querySelector<HTMLElement>('p');
        if (p) p.style.display = '';
      }
      grid.className = 'flex flex-col gap-3';
      setView(this);
      queueImgs();
    });

  for (const { el } of cards) {
    el.addEventListener('click', async () => {
      const url = el.dataset.href;
      if (!url) return;

      fetch('/api/plays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: el.dataset.name }),
      });

      if ((await bare.getTransport()) !== '/lc/index.mjs')
        await bare.setTransport('/lc/index.mjs', [{ wisp }]);

      const backend = await ConfigAPI.get('backend');
      const encoded = sj.codec.encode(url);
      const target = backend === 'v' ? vWrapper.getConfig().prefix + encoded : sj.prefix + encoded;

      window.location.href = target;
    });
  }

  refresh();
});
