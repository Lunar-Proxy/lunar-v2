if (navigator.userAgent.includes('Firefox')) {
  Object.defineProperty(globalThis, 'crossOriginIsolated', {
    value: true,
    writable: false,
  });
}
importScripts(
  '/a/bundled/v/b.js',
  '/a/bundled/v/cnfg.js',
  '/a/bundled/v/s.js',
  '/a/bundled/scram/shared.js',
  '/a/bundled/scram/worker.js',
);

const v = new UVServiceWorker();
const sj = new ScramjetServiceWorker();

let playgroundData;

self.addEventListener('message', ({ data }) => {
  if (data.type === 'playgroundData') {
    playgroundData = data;
  }
});

async function handleRequest(event) {
  if (v.route(event)) {
    return await v.fetch(event);
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
