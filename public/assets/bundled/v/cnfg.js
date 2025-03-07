UltraConfig = {
  prefix: '/up/',
  encodeUrl: (str) => {
    if (!str) return str;
    return encodeURIComponent(str);
  },

  decodeUrl: (str) => {
    if (!str) return str;
    return decodeURIComponent(str);
  },

  handler: '/assets/bundled/v/h.js',
  client: '/assets/bundled/v/c.js',
  bundle: '/assets/bundled/v/b.js',
  config: '/assets/bundled/v/cnfg.js',
  sw: '/assets/bundled/v/s.js',
  inject: [
    {
      host: /nowgg.lol*/g,
      injectTo: 'head',
      html: `<script>window.alert = function() {};</script>`,
    },
  ],
};

self.__uv$config = UltraConfig;
