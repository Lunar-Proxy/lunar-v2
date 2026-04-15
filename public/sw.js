importScripts('/data/all.js', '/tmp/config.js', '/tmp/bundle.js', '/tmp/sw.js');

let adblockEnabled = false;
let playgroundData = null;

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
const v = new UVServiceWorker();

// Ensure cookies are loaded from IndexedDB before handling any requests.
// ScramjetServiceWorker loads cookies async in its constructor, but fetch
// events can fire before that completes, causing requests to go out without
// cookies (which makes sites log the user out).
let cookiesReady = false;
const cookiesLoaded = (async () => {
  try {
    // Wait for Scramjet's internal IDB cookie load to complete.
    // The constructor opens "$scramjet" DB and reads "cookies" store.
    // We mirror that read to ensure it's done before serving fetches.
    const db = await new Promise((resolve) => {
      const req = indexedDB.open('$scramjet', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    if (!db) { cookiesReady = true; return; }
    const tx = db.transaction('cookies', 'readonly');
    const store = tx.objectStore('cookies');
    await new Promise((resolve, reject) => {
      const req = store.get('cookies');
      req.onsuccess = () => {
        if (req.result) {
          scramjet.cookieStore.load(req.result);
        }
        resolve();
      };
      req.onerror = () => resolve(); // don't block on error
    });
    db.close();
  } catch {
    // If IDB fails, continue without cookies rather than blocking forever
  }
  cookiesReady = true;
})();

self.addEventListener('message', event => {
  const { type, data } = event.data || {};
  if (type === 'playgroundData') playgroundData = event.data;
  if (type === 'ADBLOCK') adblockEnabled = !!data?.enabled;
});

const BLOCK_RULES = [
  '**://pagead2.googlesyndication.com/**',
  '**://pagead2.googleadservices.com/**',
  '**://afs.googlesyndication.com/**',
  '**://stats.g.doubleclick.net/**',
  '**://*.doubleclick.net/**',
  '**://*.googlesyndication.com/**',
  '**://adservice.google.com/**',
  '**://*.media.net/**',
  '**://adservetx.media.net/**',
  '**://*.amazon-adsystem.com/**',
  '**://*.adcolony.com/**',
  '**://*.unityads.unity3d.com/**',
  '**://pixel.facebook.com/**',
  '**://connect.facebook.net/*/fbevents.js',
  '**://*.ads-twitter.com/**',
  '**://ads-api.twitter.com/**',
  '**://*.hotjar.com/**',
  '**://*.hotjar.io/**',
  '**://*.mouseflow.com/**',
  '**://*.freshmarketer.com/**',
  '**://*.luckyorange.com/**',
  '**://stats.wp.com/**',
  '**://*.bugsnag.com/**',
  '**://*.sentry.io/**',
  '**://*.sentry-cdn.com/**',
  '**://*.2o7.net/**',
  '**://*.google-analytics.com/**',
  '**://analytics.google.com/**',
  '**://ssl.google-analytics.com/**',
  '**://click.googleanalytics.com/**',
  '**/ads.js',
  '**/ad.js',
  '**/analytics.js',
  '**/ga.js',
  '**/gtag.js',
  '**/gtm.js',
  '**/fbevents.js',
  '**/pixel.js',
];

function wildcardToRegex(p) {
  return new RegExp(
    '^' +
      p
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*') +
      '$',
    'i'
  );
}

const BLOCK_REGEX = BLOCK_RULES.map(wildcardToRegex);

function isAdRequest(url, request) {
  if (BLOCK_REGEX.some(r => r.test(url))) return true;

  try {
    const p = new URL(url);

    if (
      p.hostname === 'pagead2.googlesyndication.com' ||
      p.hostname.endsWith('.googlesyndication.com') ||
      p.hostname.endsWith('.doubleclick.net') ||
      p.hostname.endsWith('.media.net')
    )
      return true;

    if (request?.destination === 'script') {
      if (/ads|adservice|pagead|doubleclick|googlesyndication|analytics/i.test(p.pathname))
        return true;
    }

    if (request?.destination === 'ping') return true;

    if (p.search && /(utm_|gclid|fbclid|ad|ads|tracking|pixel)/i.test(p.search)) {
      return true;
    }
  } catch {}

  return false;
}

async function handleFetch(event) {
  if (!cookiesReady) await cookiesLoaded;
  await scramjet.loadConfig();
  const url = event.request.url;
  if (adblockEnabled && isAdRequest(url, event.request)) {
    return new Response(null, { status: 204 });
  }

  if (scramjet.route(event)) return scramjet.fetch(event);
  if (v.route(event)) return v.fetch(event);

  return fetch(event.request);
}

self.addEventListener('fetch', event => {
  event.respondWith(handleFetch(event));
});
