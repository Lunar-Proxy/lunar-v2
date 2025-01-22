const UltraConfig = {
  prefix: '/p/',
  encodeUrl: (str) => {
    if (!str) return str;
    const result = new Array(str.length);
    for (let i = 0; i < str.length; i++) {
      result[i] = i % 2 ? String.fromCharCode(str.charCodeAt(i) ^ 2) : str[i];
    }
    return encodeURIComponent(result.join(''));
  },

  decodeUrl: (str) => {
    if (!str) return str;
    const [input, ...search] = str.split('?');
    const decoded = decodeURIComponent(input);
    const result = new Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      result[i] =
        i % 2 ? String.fromCharCode(decoded.charCodeAt(i) ^ 2) : decoded[i];
    }
    return result.join('') + (search.length ? '?' + search.join('?') : '');
  },
  handler: '/assets/packaged/u/handler.js',
  client: '/assets/packaged/u/client.js',
  bundle: '/assets/packaged/u/bundle.js',
  config: '/assets/packaged/u/config.js',
  sw: '/assets/packaged/u/sw.js',
};

self.__uv$config = UltraConfig;
