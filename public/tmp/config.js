
const encode = (url) => {
  if (!url) return url;
  let r = '';
  for (let i = 0; i < url.length; i++) {
    r += i % 2 ? String.fromCharCode(url.charCodeAt(i) ^ 7) : url[i];
  }
  return encodeURIComponent(r);
};

const decode = (url) => {
  if (!url) return url;
  const [input, ...search] = url.split('?');
  let r = '';
  const d = decodeURIComponent(input);
  for (let i = 0; i < d.length; i++) {
    r += i % 2 ? String.fromCharCode(d.charCodeAt(i) ^ 7) : d[i];
  }
  return r + (search.length ? '?' + search.join('?') : '');
};


tmpConfig = {
  prefix: '/v1/tmp/',
  encodeUrl: encode,
  decodeUrl: decode,
  handler: '/tmp/handler.js',
  client: '/tmp/client.js',
  bundle: '/tmp/bundle.js',
  config: '/tmp/config.js',
  sw: '/tmp/sw.js',
};

self.__uv$config = tmpConfig;
