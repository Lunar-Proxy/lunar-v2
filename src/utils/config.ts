import localForage from 'localforage';

const ConfigAPI = {
  config: localForage.createInstance({
    name: 'SettingsDB',
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
      console.log(`[DEBUG] - Setting for ${key} updated.`);
    } else {
      console.log(`[WARNING] - No existing value found for ${key}.`);
    }
  },

  async initializeDefaults() {
    const defaults = {
      backend: 'uv',
      engine: 'https://duckduckgo.com/?q=',
      cloak: 'off',
      wispUrl: (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/wisp/',
    };

    for (const [key, value] of Object.entries(defaults)) {
      const existingValue = await this.get(key);
      if (existingValue === null) {
        await this.set(key, value);
        console.log(`[DEBUG] - Default value set for ${key}: ${value}`);
      }
    }
  },
};

ConfigAPI.initializeDefaults();

export default ConfigAPI;
