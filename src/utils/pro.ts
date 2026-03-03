import ConfigAPI from './config';
// @ts-ignore
const { ScramjetController } = $scramjetLoadController();
const encode = (url: string): string => {
  const i = url.indexOf('?');
  const path = i === -1 ? url : url.slice(0, i);
  const query = i === -1 ? '' : url.slice(i);
  return (
    encodeURIComponent(path)
      .split('')
      .map(c => (c.charCodeAt(0) + 1).toString(16).padStart(4, '0'))
      .join('') + query
  );
};
const decode = (url: string): string => {
  const i = url.indexOf('?');
  const path = i === -1 ? url : url.slice(0, i);
  const query = i === -1 ? '' : url.slice(i);
  let shifted = '';
  for (let j = 0; j < path.length; j += 4)
    shifted += String.fromCharCode(parseInt(path.slice(j, j + 4), 16) - 1);
  return decodeURIComponent(shifted) + query;
};
class VWrapper {
  getConfig() {
    return tmpConfig;
  }
}
class ScramjetWrapper {
  instance: any;
  private prefix: string = '';
  getConfig() {
    return {
      prefix: `/assets/${this.prefix}/`,
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
        strictRewrites: false,
        syncxhr: false,
      },
      codec: { encode, decode },
    };
  }
  async init() {
    this.prefix = await ConfigAPI.getIndecator('prefix');
    this.instance = new ScramjetController(this.getConfig());
    await this.instance.init();
    return this.instance;
  }
}
const scramjetWrapper = new ScramjetWrapper();
const vWrapper = new VWrapper();
export { scramjetWrapper, vWrapper };
