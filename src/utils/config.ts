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
  [key: string]: any;
}

type ConfigKey = string;

const isBrowser = typeof location !== 'undefined';

function wispUrl(): string {
  if (!isBrowser) return '';
  const isHttps = location.protocol === 'https:';
  return `${isHttps ? 'wss' : 'ws'}://${location.host}/w/`;
}

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
  wispUrl: wispUrl(),
  bm: [],
};

const store = localForage.createInstance({
  name: 'LunarDB',
  storeName: 'Settings',
});

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;

  const test = await store.getItem('engine');
  if (test == null) {
    const keys = Object.keys(defaults);
    await Promise.all(
      keys.map(function (key) {
        return store.setItem(key, defaults[key]);
      }),
    );
  }

  initialized = true;
}

const ConfigAPI = {
  config: store,

  async get(key: ConfigKey): Promise<any | null> {
    await ensureInit();
    return store.getItem(key);
  },

  async set(key: ConfigKey, value: any): Promise<any> {
    await ensureInit();
    return store.setItem(key, value);
  },

  async getIndecator(key: ConfigKey): Promise<any> {
    await ensureInit();
    const value = await store.getItem(key);
    if (value != null) return value;
    return defaults[key] ?? null;
  },

  async init(): Promise<void> {
    initialized = false;
    await ensureInit();
  },

  async reset(): Promise<void> {
    await store.clear();
    initialized = false;
    await ensureInit();
  },

  async getAll(): Promise<Record<string, any>> {
    await ensureInit();
    const keys = await store.keys();

    const entries = await Promise.all(
      keys.map(async function (key) {
        const value = await store.getItem(key);
        return [key, value] as const;
      }),
    );

    return Object.fromEntries(entries);
  },
};

export default ConfigAPI;
