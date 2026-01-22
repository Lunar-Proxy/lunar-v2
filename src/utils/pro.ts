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
        // obfuscator fucked this, so we needed to do it this way (send help)
        encode: new Function('url', `
          if (!url) return url;
          let result = '';
          for (let i = 0; i < url.length; i++) {
            result += i % 2 ? String.fromCharCode(url.charCodeAt(i) ^ 7) : url[i];
          }
          return encodeURIComponent(result);
        `),
        decode: new Function('url', `
          if (!url) return url;
          const parts = url.split('?');
          const input = parts[0];
          const search = parts.slice(1);
          let result = '';
          const decoded = decodeURIComponent(input);
          for (let i = 0; i < decoded.length; i++) {
            result += i % 2 ? String.fromCharCode(decoded.charCodeAt(i) ^ 7) : decoded[i];
          }
          return result + (search.length ? '?' + search.join('?') : '');
        `),
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