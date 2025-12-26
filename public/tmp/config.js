function encode(str) {
  const bytes = new TextEncoder().encode(str);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function decode(encoded) {
  const bytes = new Uint8Array(encoded.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(encoded.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
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
