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
        all: '/data/all.js',
        sync: '/data/sync.js',
      },
      flags: {
        captureErrors: false,
        cleanErrors: true,
        rewriterLogs: false,
        serviceworkers: false,
        strictRewrites: true,
        syncxhr: false,
      },
      codec: {
        encode: (data: string) => {
          const idx = data.indexOf('?');
          let path = idx === -1 ? data : data.slice(0, idx);
          let query = idx === -1 ? '' : data.slice(idx);
          let encPath = encodeURIComponent(path).replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => `~${hex}`).split('').reverse().join('');
          return encPath + query;
        },
        decode: (encoded: string) => {
          const idx = encoded.indexOf('?');
          let encPath = idx === -1 ? encoded : encoded.slice(0, idx);
          let query = idx === -1 ? '' : encoded.slice(idx);
          let path = decodeURIComponent(encPath.split('').reverse().join('').replace(/~([0-9A-Fa-f]{2})/g, '%$1'));
          return path + query;
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
const vWrapper = new VWrapper();
export { scramjetWrapper, vWrapper };
