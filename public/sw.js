importScripts('/data/all.js', '/tmp/config.js', '/tmp/bundle.js', '/tmp/sw.js');

let adblockEnabled = false;
let playgroundData = null;

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
const v = new UVServiceWorker();

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
  '**://*.facebook.com/**',
  '**://*.facebook.net/**',
  '**://*.ads-twitter.com/**',
  '**://ads-api.twitter.com/**',
  '**://*.linkedin.com/**',
  '**://*.pinterest.com/**',
  '**://*.reddit.com/**',
  '**://*.redditmedia.com/**',
  '**://*.tiktok.com/**',
  '**://*.byteoversea.com/**',
  '**://*.yahoo.com/**',
  '**://*.yahooinc.com/**',
  '**://*.yandex.ru/**',
  '**://*.yandex.net/**',
  '**://*.hotjar.com/**',
  '**://*.hotjar.io/**',
  '**://*.mouseflow.com/**',
  '**://*.freshmarketer.com/**',
  '**://*.luckyorange.com/**',
  '**://stats.wp.com/**',
  '**://*.bugsnag.com/**',
  '**://*.sentry.io/**',
  '**://*.sentry-cdn.com/**',
  '**://*.realme.com/**',
  '**://*.realmemobile.com/**',
  '**://*.xiaomi.com/**',
  '**://*.miui.com/**',
  '**://*.oppomobile.com/**',
  '**://*.hicloud.com/**',
  '**://*.oneplus.net/**',
  '**://*.oneplus.cn/**',
  '**://*.samsung.com/**',
  '**://*.2o7.net/**',
  '**://*.apple.com/**',
  '**://*.icloud.com/**',
  '**/cdn-cgi/**',
  '**://*.mzstatic.com/**',
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
    await scramjet.loadConfig();
  const url = event.request.url;
  const cdnCgiRegex = /\/cdn-cgi\//i;
  if ((adblockEnabled && isAdRequest(url, event.request)) || cdnCgiRegex.test(url)) {
    return new Response(null, { status: 204 });
  }

  if (scramjet.route(event)) return scramjet.fetch(event);
  if (v.route(event)) return v.fetch(event);

  return fetch(event.request);
}

self.addEventListener('fetch', event => {
  event.respondWith(handleFetch(event));
});
