import ConfigAPI from './config';

document.addEventListener('DOMContentLoaded', async () => {
  // @ts-ignore
  const { ScramjetController } = $scramjetLoadController();
  const scramjet = new ScramjetController({
    prefix: '/sj/',
    files: {
      wasm: '/a/bundled/scram/wasm.wasm',
      all: '/a/bundled/scram/all.js',
      sync: '/a/bundled/scram/sync.js',
    },
    flags: {
      captureErrors: true,
      cleanErrors: false,
      rewriterLogs: false,
      scramitize: false,
      serviceworkers: false,
      strictRewrites: true,
      syncxhr: false,
    },
  });

  await scramjet.init();

  const connection = new BareMux.BareMuxConnection('/bm/worker.js');
  const search = document.querySelector<HTMLInputElement>('[data-input]');
  const container = document.querySelector<HTMLDivElement>('[data-container]');
  const randomBtn = document.querySelector<HTMLButtonElement>('[data-random]');
  const sortBtn = document.querySelector<HTMLButtonElement>('[data-sort]');
  const clearBtn = document.querySelector<HTMLButtonElement>('[data-clear]');
  const gridView = document.querySelector<HTMLButtonElement>('[data-view="grid"]');
  const listView = document.querySelector<HTMLButtonElement>('[data-view="list"]');
  const compactView = document.querySelector<HTMLButtonElement>('[data-view="compact"]');
  const visibleCount = document.querySelector<HTMLSpanElement>('[data-visible]');
  
  const cards = Array.from(container?.querySelectorAll<HTMLDivElement>('.card') ?? []);
  const wispUrl = await ConfigAPI.get('wispUrl');

  if (!search || !container || !randomBtn) return;

  let sortAscending = true;

  cards.forEach(card => {
    const img = new Image();
    const bg = card.dataset.bg;
    if (!bg) return;

    img.src = bg;
    img.onload = () => {
      card.classList.remove('card-loading', 'shine');
      const bgDiv = card.querySelector('.absolute.inset-0.z-0') as HTMLElement;
      if (bgDiv) {
        bgDiv.style.backgroundImage = `url('${img.src}')`;
      }
    };
  });

  const updateVisibleCount = () => {
    const visible = cards.filter(card => card.style.display !== 'none').length;
    if (visibleCount) visibleCount.textContent = visible.toString();
  };

  search.addEventListener('input', () => {
    const query = search.value.toLowerCase().trim();
    cards.forEach(card => {
      const name = card.querySelector('h2')?.textContent?.toLowerCase() ?? '';
      const desc = card.querySelector('p')?.textContent?.toLowerCase() ?? '';
      const matches = name.includes(query) || desc.includes(query);
      card.style.display = matches ? '' : 'none';
    });
    updateVisibleCount();
  });

  randomBtn.addEventListener('click', () => {
    const visibleCards = cards.filter(card => card.style.display !== 'none');
    if (!visibleCards.length) return;
    const randomCard = visibleCards[Math.floor(Math.random() * visibleCards.length)];
    randomCard.click();
  });

  sortBtn?.addEventListener('click', () => {
    sortAscending = !sortAscending;
    const sortedCards = [...cards].sort((a, b) => {
      const nameA = a.dataset.name?.toLowerCase() ?? '';
      const nameB = b.dataset.name?.toLowerCase() ?? '';
      return sortAscending ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    const btnText = sortBtn.querySelector('span');
    if (btnText) {
      btnText.textContent = sortAscending ? 'Sort Z-A' : 'Sort A-Z';
    }

    sortedCards.forEach(card => container.appendChild(card));
  });

  clearBtn?.addEventListener('click', () => {
    if (search) search.value = '';
    cards.forEach(card => {
      card.style.display = '';
    });
    updateVisibleCount();
  });

  const setActiveView = (activeBtn: HTMLButtonElement) => {
    [gridView, listView, compactView].forEach(btn => {
      btn?.classList.remove('bg-text-secondary/20', 'text-text-header');
      btn?.classList.add('text-text-secondary');
    });
    activeBtn.classList.add('bg-text-secondary/20', 'text-text-header');
    activeBtn.classList.remove('text-text-secondary');
  };

  const applyGridView = () => {
    container?.classList.remove('flex', 'flex-col', 'space-y-6', 'grid-cols-2', 'sm:grid-cols-3', 'md:grid-cols-4', 'lg:grid-cols-6', 'gap-4');
    container?.classList.add('grid', 'grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'gap-6');
    cards.forEach(card => {
      card.className = card.className.split(' ').filter(c => !c.startsWith('h-')).join(' ') + ' h-48';
      const content = card.querySelector('.z-20');
      if (content) {
        content.classList.remove('flex-row', 'justify-start', 'text-left', 'gap-6');
        content.classList.add('items-center', 'justify-center', 'text-center');
      }
      const desc = card.querySelector('p');
      if (desc) desc.style.display = '';
    });
  };

  applyGridView();

  gridView?.addEventListener('click', () => {
    applyGridView();
    setActiveView(gridView);
  });

  listView?.addEventListener('click', () => {
    container?.classList.remove('grid', 'grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'gap-6');
    container?.classList.add('flex', 'flex-col', 'space-y-6');
    cards.forEach(card => {
      card.classList.remove('h-48', 'h-32');
      card.classList.add('h-36');
      const content = card.querySelector('.z-20');
      content?.classList.remove('items-center', 'justify-center', 'text-center');
      content?.classList.add('flex-row', 'justify-start', 'text-left', 'gap-6');
      const desc = card.querySelector('p');
      if (desc) desc.style.display = '';
    });
    setActiveView(listView);
  });

  compactView?.addEventListener('click', () => {
    container?.classList.remove('flex', 'flex-col', 'space-y-6', 'gap-6');
    container?.classList.add('grid', 'grid-cols-2', 'sm:grid-cols-3', 'md:grid-cols-4', 'lg:grid-cols-6', 'gap-4');
    cards.forEach(card => {
      card.classList.remove('h-48', 'h-36');
      card.classList.add('h-32');
      const content = card.querySelector('.z-20');
      content?.classList.remove('flex-row', 'justify-start', 'text-left', 'gap-6');
      content?.classList.add('items-center', 'justify-center', 'text-center');
      const desc = card.querySelector('p');
      if (desc) desc.style.display = 'none';
    });
    setActiveView(compactView);
  });

  cards.forEach(card => {
    card.addEventListener('click', async () => {
      const assetUrl = card.getAttribute('data-href');
      if (!assetUrl) return;

      if ((await connection.getTransport()) !== '/lc/index.mjs') {
        await connection.setTransport('/lc/index.mjs', [{ wisp: wispUrl }]);
      }

      window.location.href = scramjet.encodeUrl(assetUrl);
    });
  });

  updateVisibleCount();
});