import ConfigAPI from './config';
import { BareMuxConnection } from '@mercuryworkshop/bare-mux';
const wispUrl = await ConfigAPI.get('wispUrl');
const scramjet = new ScramjetController({
  prefix: '/sj/',
  files: {
    wasm: '/assets/bundled/scram/wasm.wasm',
    worker: '/assets/bundled/scram/worker.js',
    client: '/assets/bundled/scram/client.js',
    shared: '/assets/bundled/scram/shared.js',
    sync: '/assets/bundled/scram/sync.js',
  },
  flags: {
    serviceworkers: true,
    syncxhr: true,
  },
});

scramjet.init();
navigator.serviceWorker.register('./sw.js');
const connection = new BareMuxConnection("/bm/worker.js") 
connection.setTransport("/lc/index.mjs", [{ wisp: wispUrl }]);

async function launch() {

}