const DBNAME = 'SettingsDB';
const LunarSettings = 'Settings';
let db: IDBDatabase | undefined;
let dbReady: Promise<void>;

interface Setting {
  id?: number;
  [key: string]: any;
}

const Settings = (() => {
  dbReady = new Promise((resolve, reject) => {
    const request: IDBOpenDBRequest = window.indexedDB.open(DBNAME, 1);

    request.onupgradeneeded = () => {
      const dbInstance = request.result;
      if (!dbInstance.objectStoreNames.contains(LunarSettings)) {
        dbInstance.createObjectStore(LunarSettings, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
  const defaultSettings: Setting[] = [
    { cloak: false },
    { backend: 'uv' },
    { engine: 'https://www.google.com/search?q=' },
    { transport: 'ep' },
    { PreventClosing: false },
    {
      plugins: {
        adblock:
          "<script>(function(){const s=['#sidebar-wrap','#advert','#xrail','#middle-article-advert-container','#sponsored-recommendations','#taboola-content','#inarticle_wrapper_div','#rc-row-container','#ads','.ad','.advertisement','.ad-banner','.ad-slot','script','iframe','video','aside','amp-ad','ins.adsbygoogle'],r=()=>s.forEach(e=>document.querySelectorAll(e).forEach(n=>n.remove())),k=()=>document.querySelectorAll('body *').forEach(n=>['fixed','sticky'].includes(getComputedStyle(n).position)&&n.remove()),o=()=>{if(document.body)new MutationObserver(()=>{r(),k()}).observe(document.body,{subtree:true,childList:true})};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>{r(),k(),o()}):(r(),k(),o());})();</script>",
      },
    },
  ];

  async function ensureDefaultSettings(): Promise<void> {
    await dbReady;
    if (!db) {
      throw new Error('[Settings] Database is not initialized.');
    }

    const transaction = db.transaction([LunarSettings], 'readwrite');
    const store = transaction.objectStore(LunarSettings);

    const existingSettings: Setting[] = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    for (const setting of defaultSettings) {
      const key = Object.keys(setting)[0];
      if (!existingSettings.some((s) => key in s)) {
        store.add(setting);
      }
    }
  }

  async function add(settingName: string, value: any): Promise<void> {
    await dbReady;
    if (!db) throw new Error('[Settings] Database not ready.');

    const transaction = db.transaction([LunarSettings], 'readwrite');
    const store = transaction.objectStore(LunarSettings);

    const existingSettings: Setting[] = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const existingSetting = existingSettings.find((s) => settingName in s);
    if (existingSetting) {
      existingSetting[settingName] = value;
      store.put(existingSetting);
    } else {
      const newEntry: Setting = { [settingName]: value };
      store.add(newEntry);
    }
  }

  async function edit(settingName: string, value: any): Promise<void> {
    await dbReady;
    if (!db) throw new Error('[Settings] Database not ready.');

    const transaction = db.transaction([LunarSettings], 'readwrite');
    const store = transaction.objectStore(LunarSettings);

    const existingSettings: Setting[] = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const existingSetting = existingSettings.find((s) => settingName in s);
    if (existingSetting) {
      existingSetting[settingName] = value;
      store.put(existingSetting);
    } else {
      console.warn(`[Settings] Setting "${settingName}" does not exist.`);
    }
  }

  async function get(settingName: string): Promise<any> {
    await dbReady;
    if (!db) throw new Error('[Settings] Database not ready.');

    return new Promise((resolve, reject) => {
      if (!db) throw new Error('[Settings] Database not ready.');
      const transaction = db.transaction([LunarSettings], 'readonly');
      const store = transaction.objectStore(LunarSettings);
      const cursorRequest: IDBRequest = store.openCursor();

      cursorRequest.onsuccess = () => {
        const cursor: IDBCursorWithValue = cursorRequest.result;
        if (cursor) {
          if (cursor.value[settingName] !== undefined) {
            resolve(cursor.value[settingName]);
            return;
          }
          cursor.continue();
        } else {
          resolve(undefined);
        }
      };

      cursorRequest.onerror = () => {
        reject(new Error('[Settings] Error retrieving setting by name.'));
      };
    });
  }

  dbReady.then(() => ensureDefaultSettings());

  return { add, get, edit };
})();

export { Settings };
