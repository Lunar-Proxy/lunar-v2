import ConfigAPI from "./config";

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
  await navigator.serviceWorker.register('./sw.js');

  const connection = new BareMux.BareMuxConnection('/bm/worker.js');
  const search = document.querySelector<HTMLInputElement>('[data-input]');
  const container = document.querySelector<HTMLDivElement>('[data-container]');
  const random = document.querySelector<HTMLButtonElement>('[data-random]');
  const cards = container?.querySelectorAll<HTMLDivElement>('.card') ?? [];
  const wispUrl = await ConfigAPI.get('wispUrl');

  if (!search || !container || !random) return;

  random.addEventListener('click', () => {
    const visibleCards = Array.from(cards).filter(card => card.style.display !== 'none');
    if (!visibleCards.length) return;
    const randomCard = visibleCards[Math.floor(Math.random() * visibleCards.length)];
    randomCard.dispatchEvent(new Event('click'));
  });

  search.addEventListener('input', () => {
    const query = search.value.toLowerCase().trim();
    cards.forEach(card => {
      const name = card.querySelector('h2')?.textContent?.toLowerCase() ?? '';
      const desc = card.querySelector('p')?.textContent?.toLowerCase() ?? '';
      card.style.display = (name.includes(query) || desc.includes(query)) ? '' : 'none';
    });
  });

  for (const card of cards) {
    card.addEventListener('click', async () => {
      const assetUrl = card.getAttribute('data-href');
      if (!assetUrl) return;
      if ((await connection.getTransport()) !== '/lc/index.mjs') {
        await connection.setTransport('/lc/index.mjs', [{ wisp: wispUrl }]);
      }
      window.location.href = scramjet.encodeUrl(assetUrl);
    });
  }
});
