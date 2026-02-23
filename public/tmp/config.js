function rotHost(host) {
  return host.split('').map(function(c) {
    var n = c.charCodeAt(0);
    if (n >= 97 && n <= 122) return String.fromCharCode(((n - 97 + 13) % 26) + 97);
    if (n >= 65 && n <= 90)  return String.fromCharCode(((n - 65 + 13) % 26) + 97);
    if (n >= 48 && n <= 57)  return String.fromCharCode(((n - 48 + 5)  % 10) + 48);
    return c;
  }).join('');
}

function encode(url) {
  if (!url) return url;
  var parts = url.split('?');
  var base = parts[0];
  var query = parts.length > 1 ? '?' + parts.slice(1).join('?') : '';
  var encoded = base.replace(/^([\w+.-]+:\/\/)([^/?#]+)/, function(_, proto, host) {
    return proto + rotHost(host);
  });
  return encodeURIComponent(encoded) + query;
};

function decode(url) {
  if (!url) return url;
  var parts = url.split('?');
  var input = parts[0];
  var query = parts.length > 1 ? '?' + parts.slice(1).join('?') : '';
  var decoded = decodeURIComponent(input).replace(/^([\w+.-]+:\/\/)([^/?#]+)/, function(_, proto, host) {
    return proto + host.split('').map(function(c) {
      var n = c.charCodeAt(0);
      if (n >= 97 && n <= 122) return String.fromCharCode(((n - 97 + 13) % 26) + 97);
      if (n >= 48 && n <= 57)  return String.fromCharCode(((n - 48 + 5)  % 10) + 48);
      return c;
    }).join('');
  });
  return decoded + query;
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
