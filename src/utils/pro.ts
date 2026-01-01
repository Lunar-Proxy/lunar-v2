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
          if (!data) return '';
          const reversed = data.toString().split('').reverse().join('');
          return encodeURIComponent(reversed);
        },
        decode: (encoded: string) => {
          if (!encoded) return '';
          try {
            const qIndex = encoded.indexOf('?');
            const path = qIndex >= 0 ? encoded.slice(0, qIndex) : encoded;
            const query = qIndex >= 0 ? encoded.slice(qIndex) : '';
            return decodeURIComponent(path).split('').reverse().join('') + query;
          } catch {
            return encoded;
          }
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
