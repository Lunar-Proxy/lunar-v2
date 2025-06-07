import localForage from 'localforage';

const ConfigAPI = {
  config: localForage.createInstance({
    name: 'LunarDB',
    storeName: 'Settings',
  }),

  async get(key: string) {
    return await this.config.getItem(key);
  },

  async set(key: string, value: any) {
    return await this.config.setItem(key, value);
  },

  async edit(key: string, newValue: any) {
    const existingValue = await this.get(key);
    if (existingValue !== null) {
      await this.set(key, newValue);
      console.debug(`[DEBUG] - Setting for ${key} updated.`);
    } else {
      console.warn(`[WARNING] - No existing value found for ${key}.`);
    }
  },

  async init() {
    const defaults = {
      backend: 'sj',
      engine: 'https://duckduckgo.com/?q=',
      cloak: 'off',
      wispUrl: (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/wisp/',
      bm: [
        {
          name: 'Youtube',
          logo: '/api/icon/?url=https://www.youtube.com/',
          redir: 'https://www.youtube.com',
        },
        {
          name: 'Google',
          logo: '/api/icon/?url=https://www.google.com/',
          redir: 'https://www.google.com',
        },
        {
          name: 'X',
          logo: '/api/icon/?url=https://www.x.com/',
          redir: 'https://www.x.com',
        },
        {
          name: 'Spotify',
          logo: '/api/icon/?url=https://www.spotify.com/',
          redir: 'https://www.spotify.com',
        },
        {
          name: 'Discord',
          logo: '/api/icon/?url=https://www.discord.com/',
          redir: 'https://www.discord.com',
        },
      ],
    };

    for (const [key, value] of Object.entries(defaults)) {
      const existing = await this.get(key);
      if (existing === null) {
        await this.set(key, value);
      }
    }
  },
};

ConfigAPI.init();

export default ConfigAPI;
