import localForage from 'localforage';

interface Bookmark {
  name: string;
  logo: string;
  redir: string;
}

interface ConfigDefaults {
  engine: string;
  cloak: 'on' | 'off';
  adBlock: 'on' | 'off';
  cloakTitle: string;
  cloakFavicon: string;
  autoCloak: 'on' | 'off';
  beforeUnload: 'on' | 'off';
  backend: string;
  panicLoc: string;
  panicKey: string;
  wispUrl: string;
  bm: Bookmark[];
}

type ConfigKey = keyof ConfigDefaults;

const ConfigAPI = {
  config: localForage.createInstance({
    name: 'LunarDB',
    storeName: 'Settings',
  }),

  async get<K extends ConfigKey>(key: K): Promise<ConfigDefaults[K] | null> {
    return this.config.getItem(key);
  },

  async set<K extends ConfigKey>(key: K, value: ConfigDefaults[K]): Promise<ConfigDefaults[K]> {
    return this.config.setItem(key, value);
  },

  async init(): Promise<void> {
    const wispUrlDefault =
      typeof location !== 'undefined' && typeof location.protocol === 'string'
        ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/w/`
        : '';

    const defaults: ConfigDefaults = {
      engine: 'https://duckduckgo.com/?q=',
      cloak: 'off',
      adBlock: 'on',
      cloakTitle: 'Google',
      cloakFavicon: 'https://www.google.com/favicon.ico',
      autoCloak: 'off',
      beforeUnload: 'off',
      backend: 'sc',
      panicLoc: 'https://google.com',
      panicKey: '`',
      wispUrl: wispUrlDefault,
      bm: [
        {
          name: 'Youtube',
          logo: 'https://www.youtube.com/favicon.ico',
          redir: 'https://www.youtube.com',
        },
        {
          name: 'Google',
          logo: 'https://www.google.com/favicon.ico',
          redir: 'https://www.google.com',
        },
        {
          name: 'X',
          logo: 'https://www.x.com/favicon.ico',
          redir: 'https://www.x.com',
        },
        {
          name: 'Spotify',
          logo: 'https://www.spotify.com/favicon.ico',
          redir: 'https://www.spotify.com',
        },
        {
          name: 'Discord',
          logo: 'https://www.discord.com/favicon.ico',
          redir: 'https://www.discord.com',
        },
      ],
    };

    const keys = Object.keys(defaults) as ConfigKey[];
    const existingValues = await Promise.all(keys.map(key => this.get(key)));

    const updates = keys
      .map((key, index) => {
        if (existingValues[index] == null) {
          return this.set(key, defaults[key]);
        }
        return null;
      })
      .filter(Boolean);

    await Promise.all(updates);
  },

  async reset(): Promise<void> {
    await this.config.clear();
    await this.init();
  },

  async getAll(): Promise<Partial<ConfigDefaults>> {
    const keys = (await this.config.keys()) as ConfigKey[];
    const values = await Promise.all(
      keys.map(async key => ({
        key,
        value: (await this.config.getItem(key)) as ConfigDefaults[ConfigKey] | undefined,
      })),
    );

    return values.reduce((acc, { key, value }) => {
      (acc as any)[key] = value;
      return acc;
    }, {} as Partial<ConfigDefaults>);
  },
};

export default ConfigAPI;
