/// <reference path="../.astro/types.d.ts" />

const LAST_UPDATED: string;
const VERSION: string;
const UltraConfig: UltraConfig;
const BareMux: any;
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

interface ScramjetOptions {
  prefix: string;
  files: ScramjetFiles;
}

declare class ScramjetController {
  constructor(options: ScramjetOptions);
  init(): any;
  decodeUrl(url: string): string;
  encodeUrl(url: string): string;
}

interface Window {
  sj: any;
  eruda: any;
}

declare module '@mercuryworkshop/epoxy-transport';
declare module '@mercuryworkshop/wisp-js/server';
declare module '@mercuryworkshop/bare-mux/node';
declare module '@mercuryworkshop/libcurl-transport';
