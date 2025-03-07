/// <reference path="../.astro/types.d.ts" />

const LAST_UPDATED: string;
const VERSION: string;
const UltraConfig: UltraConfig;
const ScramjetController: any;

interface UltraConfig {
  prefix: string;
  encodeUrl: (str: string) => string | null;
  decodeUrl: (str: string) => string | null;
}

interface ScramjetFiles {
  wasm: string;
  worker: string;
  client: string;
  shared: string;
  sync: string;
}

interface ScramjetFlags {
  serviceworkers: boolean;
  syncxhr: boolean;
}

interface ScramjetConfig {
  prefix: string;
  files: ScramjetFiles;
  flags: ScramjetFlags;
}

const scram: ScramjetConfig = {
  prefix: '/scram/',
  files: {
    wasm: '/assets/packaged/scram/wasm.js',
    worker: '/assets/packaged/scram/worker.js',
    client: '/assets/packaged/scram/client.js',
    shared: '/assets/packaged/scram/shared.js',
    sync: '/assets/packaged/scram/sync.js',
  },
  flags: {
    serviceworkers: true,
    syncxhr: true,
  },
};

interface Window {
  sj: any;
  eruda: any;
}

interface Scram {}

declare module '@mercuryworkshop/epoxy-transport';
declare module '@mercuryworkshop/wisp-js/server';
declare module '@mercuryworkshop/bare-mux/node';
declare module '@mercuryworkshop/libcurl-transport';
