let UltraConfig = {
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

async function GetPluginValue() {
  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('SettingsDB', 1);

    dbRequest.onsuccess = (e) => {
      const db = e.target.result;
      const transaction = db.transaction('Settings', 'readonly');
      const store = transaction.objectStore('Settings');
      const getRequest = store.getAll();

      getRequest.onsuccess = (event) => {
        const result = event.target.result;
        for (const record of result) {
          if (record.plugins && typeof record.plugins === 'object') {
            resolve(Object.values(record.plugins));
            return;
          }
        }
        resolve([]);
      };

      getRequest.onerror = () => reject('Error retrieving plugins from DB');
    };

    dbRequest.onerror = () => reject('Error opening IndexedDB');
  });
}

GetPluginValue()
  .then((values) => {
    if (!values.length) {
      console.log('[PLUGIN MANAGER] No plugins found');
      return;
    }

    console.log('[PLUGIN MANAGER] Enabling plugins');

    UltraConfig.inject = [
      ...UltraConfig.inject.filter((entry) => entry.host.toString() !== '/.*/'),
      ...values.map((value) => ({
        host: /.*/,
        injectTo: 'head',
        html: value,
      })),
    ];
  })
  .catch((error) => {
    console.error(error);
  });
