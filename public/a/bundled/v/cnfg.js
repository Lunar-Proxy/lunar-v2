UltraConfig = {
  prefix: '/pre/',
  encodeUrl: (str) => {
    if (!str) return str;
    return encodeURIComponent(str);
  },

  decodeUrl: (str) => {
    if (!str) return str;
    return decodeURIComponent(str);
  },

  handler: '/a/bundled/v/h.js',
  client: '/a/bundled/v/c.js',
  bundle: '/a/bundled/v/b.js',
  config: '/a/bundled/v/cnfg.js',
  sw: '/a/bundled/v/s.js',
  inject: [
    {
      host: /nowgg.lol*/g,
      injectTo: 'head',
      html: `<script>window.alert = function() {};</script>`,
    },
  ],
};

self.__uv$config = UltraConfig;
