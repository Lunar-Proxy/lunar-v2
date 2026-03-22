importScripts('/data/all.js', '/tmp/config.js', '/tmp/bundle.js', '/tmp/sw.js');

let adblockEnabled = false;
let configLoaded = false;

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
const v = new UVServiceWorker();

self.addEventListener('message', event => {
  const { type, data } = event.data || {};
  if (type === 'ADBLOCK') adblockEnabled = !!data?.enabled;
});

const BLOCK_RULES = [
  '**://pagead2.googlesyndication.com/**',
  '**://pagead2.googleadservices.com/**',
  '**://afs.googlesyndication.com/**',
  '**://*.googlesyndication.com/**',
  '**://adservice.google.com/**',
  '**://*.doubleclick.net/**',
  '**://stats.g.doubleclick.net/**',
  '**://*.google-analytics.com/**',
  '**://analytics.google.com/**',
  '**://ssl.google-analytics.com/**',
  '**://click.googleanalytics.com/**',
  '**://www.googletagmanager.com/**',
  '**://www.googletagservices.com/**',
  '**://*.media.net/**',
  '**://adservetx.media.net/**',
  '**://*.amazon-adsystem.com/**',
  '**://*.adcolony.com/**',
  '**://*.unityads.unity3d.com/**',
  '**://*.moatads.com/**',
  '**://*.outbrain.com/**',
  '**://*.taboola.com/**',
  '**://*.criteo.com/**',
  '**://*.criteo.net/**',
  '**://*.rubiconproject.com/**',
  '**://*.pubmatic.com/**',
  '**://*.openx.net/**',
  '**://*.appnexus.com/**',
  '**://*.adnxs.com/**',
  '**://*.smartadserver.com/**',
  '**://*.smaato.net/**',
  '**://*.spotxchange.com/**',
  '**://*.sharethrough.com/**',
  '**://*.yieldmo.com/**',
  '**://*.tremorhub.com/**',
  '**://*.33across.com/**',
  '**://*.sovrn.com/**',
  '**://*.lijit.com/**',
  '**://*.facebook.com/tr/**',
  '**://*.facebook.net/*/fbevents.js',
  '**://*.ads-twitter.com/**',
  '**://ads-api.twitter.com/**',
  '**://static.ads-twitter.com/**',
  '**://*.linkedin.com/px/**',
  '**://*.pinterest.com/ct/**',
  '**://*.redditmedia.com/pixels/**',
  '**://*.tiktok.com/i18n/pixel/**',
  '**://*.byteoversea.com/**',
  '**://*.snapchat.com/tr/**',
  '**://*.yahoo.com/**',
  '**://*.yahooinc.com/**',
  '**://*.yandex.ru/**',
  '**://*.yandex.net/**',
  '**://*.hotjar.com/**',
  '**://*.hotjar.io/**',
  '**://*.mouseflow.com/**',
  '**://*.freshmarketer.com/**',
  '**://*.luckyorange.com/**',
  '**://*.fullstory.com/**',
  '**://*.logrocket.com/**',
  '**://*.inspectlet.com/**',
  '**://*.clarity.ms/**',
  '**://stats.wp.com/**',
  '**://*.bugsnag.com/**',
  '**://*.sentry.io/**',
  '**://*.sentry-cdn.com/**',
  '**://*.mixpanel.com/**',
  '**://*.amplitude.com/**',
  '**://*.segment.com/**',
  '**://*.segment.io/**',
  '**://*.intercom.io/**',
  '**://*.intercomcdn.com/**',
  '**://*.heapanalytics.com/**',
  '**://*.chartbeat.com/**',
  '**://*.chartbeat.net/**',
  '**://*.newrelic.com/**',
  '**://*.nr-data.net/**',
  '**://*.2o7.net/**',
  '**://*.omtrdc.net/**',
  '**://*.demdex.net/**',
  '**://*.adobedtm.com/**',
  '**://*.realme.com/**',
  '**://*.realmemobile.com/**',
  '**://*.xiaomi.com/**',
  '**://*.miui.com/**',
  '**://*.oppomobile.com/**',
  '**://*.hicloud.com/**',
  '**://*.oneplus.net/**',
  '**://*.oneplus.cn/**',
  '**://*.samsung.com/**',
  '**://*.apple.com/**',
  '**://*.icloud.com/**',
  '**://*.mzstatic.com/**',
  '**/cdn-cgi/**',
  '**/ads.js',
  '**/ad.js',
  '**/analytics.js',
  '**/ga.js',
  '**/gtag.js',
  '**/gtm.js',
  '**/fbevents.js',
  '**/pixel.js',
  '**/tracking.js',
  '**/tracker.js',
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
      p.hostname.endsWith('.googlesyndication.com') ||
      p.hostname.endsWith('.doubleclick.net') ||
      p.hostname.endsWith('.media.net') ||
      p.hostname.endsWith('.criteo.com') ||
      p.hostname.endsWith('.adnxs.com')
    )
      return true;

    if (request?.destination === 'script') {
      if (
        /ads|adservice|pagead|doubleclick|googlesyndication|analytics|tracker|pixel|telemetry/i.test(
          p.pathname
        )
      )
        return true;
    }

    if (request?.destination === 'ping') return true;

    if (p.search && /(utm_|gclid|fbclid|ttclid|msclkid|ad|ads|tracking|pixel)/i.test(p.search))
      return true;
  } catch {}

  return false;
}

async function handleFetch(event) {
  if (!configLoaded) {
    await scramjet.loadConfig();
    configLoaded = true;
  }

  const url = event.request.url;

  if ((adblockEnabled && isAdRequest(url, event.request)) || /\/cdn-cgi\//i.test(url)) {
    return new Response(null, { status: 204 });
  }

  if (scramjet.route(event)) return scramjet.fetch(event);
  if (v.route(event)) return v.fetch(event);

  return fetch(event.request);
}

self.addEventListener('fetch', event => {
  event.respondWith(handleFetch(event));
});
