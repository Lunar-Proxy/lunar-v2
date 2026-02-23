// @ts-ignore
const { ScramjetController } = $scramjetLoadController();

class VWrapper {
  getConfig() {
    return tmpConfig;
  }
}

class ScramjetWrapper {
  instance: any;

  getConfig() {
    return {
      prefix: '/v1/data/',
      files: {
        wasm: '/data/wasm.wasm',
        all:  '/data/all.js',
        sync: '/data/sync.js',
      },
      flags: {
        captureErrors:  false,
        cleanErrors:    true,
        rewriterLogs:   false,
        serviceworkers: false,
        strictRewrites: false,
        syncxhr:        false,
      },
      codec: {
        encode: (url: string): string => {
  const [base, ...rest] = url.split('?');
  const query = rest.length ? '?' + rest.join('?') : '';

  const rotHost = base.replace(/^(\w+:\/\/)([^/?#]+)/, (_: string, proto: string, host: string) =>
    proto + host.split('').map((c: string) => {
      const n = c.charCodeAt(0);
      if (n >= 97 && n <= 122) return String.fromCharCode(((n - 97 + 13) % 26) + 97);
      if (n >= 65 && n <= 90)  return String.fromCharCode(((n - 65 + 13) % 26) + 97);
      if (n >= 48 && n <= 57)  return String.fromCharCode(((n - 48 + 5)  % 10) + 48);
      return c;
    }).join('')
  );

  return encodeURIComponent(rotHost) + query;
},
        // @ts-ignore
        decode: (url: string): string => {
          const decoded = decodeURIComponent(url);
          return decoded.replace(/^(\w+:\/\/)([^/?#]+)/, (_: string, proto: string, host: string) =>
            proto + host.split('').map((c: string) => {
              const n = c.charCodeAt(0);
              if (n >= 97 && n <= 122) return String.fromCharCode(((n - 97 + 13) % 26) + 97);
              if (n >= 48 && n <= 57)  return String.fromCharCode(((n - 48 + 5)  % 10) + 48);
              return c;
            }).join('')
          );
        },
      },
    };
  }

  async init() {
    this.instance = new ScramjetController(this.getConfig());
    await this.instance.init();
    return this.instance;
  }
}

const scramjetWrapper = new ScramjetWrapper();
const vWrapper        = new VWrapper();
export { scramjetWrapper, vWrapper };