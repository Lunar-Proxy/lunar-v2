function encode(str) {
  if (!str) return '';
  const reversed = str.toString().split('').reverse().join('');
  return encodeURIComponent(reversed).replace(/[a-zA-Z]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function decode(encoded) {
  if (!encoded) return '';
  const qIndex = encoded.indexOf('?');
  const path = qIndex >= 0 ? encoded.slice(0, qIndex) : encoded;
  const query = qIndex >= 0 ? encoded.slice(qIndex) : '';
  return decodeURIComponent(path).split('').reverse().join('') + query;
}

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
