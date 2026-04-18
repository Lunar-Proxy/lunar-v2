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

async function getWispUrl(): Promise<string> {
  if (!isBrowser) {
    return 'wss://nightwisp.me.cdn.cloudflare.net/wisp/';
  }

  const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/w/`;
  const isUp = await new Promise<boolean>(function (resolve) {

    let done = false;
    const socket = new WebSocket(wsUrl);

    function finish(ok: boolean): void {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(ok);
    }

    socket.onopen = function () {
      finish(true);
      try {
        socket.close();
      } catch {}
    };

    socket.onerror = function () {
      finish(false);
    };

    socket.onclose = function () {
      if (!done) finish(false);
    };

    const timer = setTimeout(function () {
      finish(false);
      try {
        socket.close();
      } catch {}
    }, 2500);
  });

  if (isUp) return wsUrl;

  console.warn('Fallback to static');
  const random = Math.random().toString(36).substring(2, 8);
  return `wss://${random}.nightwisp.me.cdn.cloudflare.net/wisp/`;
}

const defaults: ConfigDefaults = {
  engine: 'https://duckduckgo.com/?q=',
  cloak: 'off',
  adBlock: 'on',
  transport: 'lc',
  cloakTitle: 'Google',
  cloakFavicon: 'https://www.google.com/favicon.ico',
  autoCloak: 'off',
  beforeUnload: 'off',
  backend: 'sc',
  panicLoc: 'https://google.com',
  panicKey: '`',
  wispUrl: '',
  bm: [],
};

const store = localForage.createInstance({
  name: 'LunarDB',
  storeName: 'Settings',
});

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;

  if (isBrowser && !defaults.wispUrl) {
    defaults.wispUrl = await getWispUrl();
  }

  const test = await store.getItem('engine');
  if (test == null) {
    const keys = Object.keys(defaults);
    await Promise.all(
      keys.map(function (key) {
        return store.setItem(key, defaults[key]);
      })
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
      })
    );

    return Object.fromEntries(entries);
  },
};

export default ConfigAPI;
