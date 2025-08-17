if (navigator.userAgent.includes('Firefox')) {
  Object.defineProperty(globalThis, 'crossOriginIsolated', {
    value: true,
    writable: false,
  });
}
importScripts('/a/bundled/scram/all.js');

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const sj = new ScramjetServiceWorker();

let playgroundData;

self.addEventListener('message', ({ data }) => {
  if (data.type === 'playgroundData') {
    playgroundData = data;
  }
});

async function handleRequest(event) {
  await sj.loadConfig();
  if (sj.route(event)) {
    return sj.fetch(event);
  }
  return await fetch(event.request);
}

self.addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
});
