import localForage from 'localforage';
import { nanoid } from 'nanoid';

const prefix = `chunk-${nanoid(8)
  .toLowerCase()
  .replace(/[^a-z0-9]/g, 'x')}`;

interface Bookmark {
  name: string;
  logo: string;
  redir: string;
}

interface ConfigDefaults {
  engine: string;
  cloak: 'on' | 'off';
  adBlock: 'on' | 'off';
  prefix: string;
  cloakTitle: string;
  cloakFavicon: string;
  autoCloak: 'on' | 'off';
  beforeUnload: 'on' | 'off';
  backend: string;
  panicLoc: string;
  panicKey: 'on' | 'off';
  panicKeyBind: string;
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
  prefix: prefix,
  backend: 'sc',
  panicLoc: 'https://google.com',
  panicKeyBind: '`',
  panicKey: 'on',
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

  await Promise.all(
    Object.keys(defaults).map(async key => {
      const existing = await store.getItem(key);
      if (existing == null) {
        await store.setItem(key, defaults[key]);
      }
    }),
  );

  initialized = true;
}

const ConfigAPI = {
  config: store,

  async get(key: ConfigKey): Promise<any> {
    await ensureInit();
    return store.getItem(key);
  },

  async set(key: ConfigKey, value: any): Promise<any> {
    await ensureInit();
    return store.setItem(key, value);
  },

  async delete(key: ConfigKey): Promise<void> {
    await ensureInit();
    await store.removeItem(key);
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
      keys.map(async key => {
        const value = await store.getItem(key);
        return [key, value] as const;
      }),
    );
    return Object.fromEntries(entries);
  },
};

export default ConfigAPI;
