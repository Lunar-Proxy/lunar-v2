if (navigator.userAgent.includes('Firefox')) {
  Object.defineProperty(globalThis, 'crossOriginIsolated', {
    value: true,
    writable: false,
  });
}
importScripts(
  '/assets/bundled/v/b.js',
  '/assets/bundled/v/cnfg.js',
  '/assets/bundled/v/s.js',
  '/assets/bundled/scram/shared.js',
  '/assets/bundled/scram/worker.js',
);

const u = new UVServiceWorker();
const sj = new ScramjetServiceWorker();

let playgroundData;

self.addEventListener('message', ({ data }) => {
  if (data.type === 'playgroundData') {
    playgroundData = data;
  }
});

async function handleRequest(event) {
  if (u.route(event)) {
    return await u.fetch(event);
  }

  await sj.loadConfig();
  if (sj.route(event)) {
    return sj.fetch(event);
  }
  return await fetch(event.request);
}

self.addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event));
});
