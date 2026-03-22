let _ScramjetController: any = null;
function getScramjetController(): any {
  if (!_ScramjetController) {
    // @ts-ignore
    const loaded = $scramjetLoadController();
    _ScramjetController = loaded.ScramjetController;
  }
  return _ScramjetController;
}

class VWrapper {
  getConfig() {
    return tmpConfig;
  }
}

function encode(url: string): string {
  if (!url) return url;
  let out = '';
  for (let i = 0; i < url.length; i++) {
    out += i % 2 ? String.fromCharCode(url.charCodeAt(i) ^ 3) : url[i];
  }
  return encodeURIComponent(out);
}

function decode(url: string): string {
  if (!url) return url;
  const split = url.indexOf('?');
  const path = split < 0 ? url : url.slice(0, split);
  const qs = split < 0 ? '' : url.slice(split);
  const decoded = decodeURIComponent(path);
  let out = '';
  for (let i = 0; i < decoded.length; i++) {
    out += i % 2 ? String.fromCharCode(decoded.charCodeAt(i) ^ 3) : decoded[i];
  }
  return out + qs;
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
        rewriterLogs: false,
        scramitize: false,
        cleanErrors: true,
        sourcemaps: true,
      },
      codec: {
        encode,
        decode,
      },
    };
  }

  async init() {
    const ScramjetController = getScramjetController();
    this.instance = new ScramjetController(this.getConfig());
    await this.instance.init();
    return this.instance;
  }
}

const scramjetWrapper = new ScramjetWrapper();
const vWrapper = new VWrapper();

export { scramjetWrapper, vWrapper };
