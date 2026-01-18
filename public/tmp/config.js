const encode = (data) => {
  const idx = data.indexOf('?');
  let path = idx === -1 ? data : data.slice(0, idx);
  let query = idx === -1 ? '' : data.slice(idx);
  let encPath = encodeURIComponent(path).replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => `~${hex}`).split('').reverse().join('');
  return encPath + query;
};

const decode = (encoded) => {
  const idx = encoded.indexOf('?');
  let encPath = idx === -1 ? encoded : encoded.slice(0, idx);
  let query = idx === -1 ? '' : encoded.slice(idx);
  let path = decodeURIComponent(encPath.split('').reverse().join('').replace(/~([0-9A-Fa-f]{2})/g, '%$1'));
  return path + query;
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
