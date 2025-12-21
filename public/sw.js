importScripts(
  '/data/all.js',
  '/tmp/config.js',
  '/tmp/bundle.js',
  '/tmp/sw.js'
);
 
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
  '**://*.doubleclick.net/**',
  '**://*.googlesyndication.com/**',
  '**://*.google-analytics.com/**',
  '**://*.googletagmanager.com/**',
  '**://*.googletagservices.com/**',
  '**://adservice.google.com/**',
  '**://pagead2.googlesyndication.com/**',
  '**://youtube.com/api/stats/**',
  '**://*.facebook.net/**',
  '**://connect.facebook.net/**',
  '**://graph.facebook.com/**',
  '**://*.amazon-adsystem.com/**',
  '**://ads.twitter.com/**',
  '**://analytics.twitter.com/**',
  '**://bat.bing.com/**',
  '**://clarity.ms/**',
  '**://*.adnxs.com/**',
  '**://*.openx.net/**',
  '**://*.rubiconproject.com/**',
  '**://*.criteo.com/**',
  '**://*.taboola.com/**',
  '**://*.outbrain.com/**',
  '**://*.pubmatic.com/**',
  '**://*.moatads.com/**',
  '**://*.smartadserver.com/**',
  '**://*.scorecardresearch.com/**',
  '**://*.quantserve.com/**',
  '**://*.chartbeat.net/**',
  '**://*.hotjar.com/**',
  '**://*.mixpanel.com/**',
  '**://*.segment.io/**',
  '**://*.amplitude.com/**',
  '**/ads/**',
  '**/ad/**',
  '**/advert/**',
  '**/advertising/**',
  '**/analytics/**',
  '**/track/**',
  '**/tracking/**',
  '**/pixel/**',
  '**/beacon/**',
  '**/events/**',
  '**/sponsored/**',
  '**/sponsered/**',
  '**/sponsor/**',
  '**/sponsorship/**',
  '**/promoted/**',
  '**/promotion/**',
  '**/promo/**',
  '**/paid/**',
  '**/partner/**',
  '**/partners/**',
  '**/brand/**',
  '**/branded/**',
  '**/native/**',
  '**/*?*sponsored*',
  '**/*?*promoted*',
  '**/*?*promo*',
  '**/*?*ad=*',
  '**/*?*ads=*',
  '**/*?*utm_*',
];


function wildcardToRegex(pattern) {
  return new RegExp('^' + pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*') + '$', 'i');
}


const BLOCK_REGEX = BLOCK_RULES.map(wildcardToRegex);
const isAdRequest = url => BLOCK_REGEX.some(rule => rule.test(url));


async function handleFetch(event) {
  await scramjet.loadConfig();
  const url = event.request.url;
  if (adblockEnabled && isAdRequest(url)) return new Response(null, { status: 204 });
  if (scramjet.route(event)) return scramjet.fetch(event);
  if (v.route(event)) return v.fetch(event);
  return fetch(event.request);
}

self.addEventListener('fetch', event => {
  event.respondWith(handleFetch(event));
});
