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
        // obfuscator broke this so....
        encode: eval(`(function(url){if(!url)return url;let r='';for(let i=0;i<url.length;i++){r+=i%2?String.fromCharCode(url.charCodeAt(i)^7):url[i];}return encodeURIComponent(r);})`),
        decode: eval(`(function(url){if(!url)return url;const [input,...search]=url.split('?');let r='';const d=decodeURIComponent(input);for(let i=0;i<d.length;i++){r+=i%2?String.fromCharCode(d.charCodeAt(i)^7):d[i];}return r+(search.length?'?'+search.join('?'):'');})`),
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
