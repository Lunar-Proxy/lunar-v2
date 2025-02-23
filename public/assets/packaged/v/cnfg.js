UltraConfig = {
  prefix: '/p/',
  encodeUrl: (str) => {
    if (!str) return str;
    return encodeURIComponent(str)
  },

  decodeUrl: (str) => {
    if (!str) return str;
    return decodeURIComponent(str);
  },

  handler: '/assets/packaged/v/h.js',
  client: '/assets/packaged/v/c.js',
  bundle: '/assets/packaged/v/b.js',
  config: '/assets/packaged/v/cnfg.js',
  sw: '/assets/packaged/v/s.js',
  inject: [
    {
      host: /nowgg.lol*/g,
      injectTo: 'head',
      html: `<script>window.alert = function() {};</script>`,
    },
  ],
};

self.__uv$config = UltraConfig;

