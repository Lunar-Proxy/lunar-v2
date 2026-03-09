// @ts-ignore
const { ScramjetController } = $scramjetLoadController();

class VWrapper {
  getConfig() {
    return tmpConfig;
  }
}

function encode(url: string): string {
  const i = url.indexOf('?');
  const path = i === -1 ? url : url.slice(0, i);
  const query = i === -1 ? '' : url.slice(i);
  return (
    encodeURIComponent(path)
      .split('')
      .map(c => {
        if (c >= 'a' && c <= 'z') {
          return c === 'z' ? 'a' : String.fromCharCode(c.charCodeAt(0) + 1);
        } else if (c >= 'A' && c <= 'Z') {
          return c === 'Z' ? 'A' : String.fromCharCode(c.charCodeAt(0) + 1);
        } else {
          return c;
        }
      })
      .join('') + query
  );
}

function decode(url: string): string {
  const i = url.indexOf('?');
  const path = i === -1 ? url : url.slice(0, i);
  const query = i === -1 ? '' : url.slice(i);
  let shifted = '';
  for (let j = 0; j < path.length; ++j) {
    const c = path[j];
    if (c >= 'a' && c <= 'z') {
      shifted += c === 'a' ? 'z' : String.fromCharCode(c.charCodeAt(0) - 1);
    } else if (c >= 'A' && c <= 'Z') {
      shifted += c === 'A' ? 'Z' : String.fromCharCode(c.charCodeAt(0) - 1);
    } else {
      shifted += c;
    }
  }
  return decodeURIComponent(shifted) + query;
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
    this.instance = new ScramjetController(this.getConfig());
    await this.instance.init();
    return this.instance;
  }
}

const scramjetWrapper = new ScramjetWrapper();
const vWrapper = new VWrapper();

console.log(scramjetWrapper.getConfig().prefix);
export { scramjetWrapper, vWrapper };
