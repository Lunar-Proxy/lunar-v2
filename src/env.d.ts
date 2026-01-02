/// <reference path="../.astro/types.d.ts" />

declare const LAST_UPDATED: string;
declare const VERSION: string;
declare const BareMux: any;

interface tmpConfig {
  prefix: string;
  encodeUrl: (str: string) => string;
  decodeUrl: (encodedUrl: string) => string;
}

declare const tmpConfig: tmpConfig;
declare const LC_NAME: string;
declare const BM_NAME: string;

interface ScramjetFiles {
  wasm: string;
  all: string;
  sync: string;
}

interface ScramjetOptions {
  prefix: string;
  files: ScramjetF iles;
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
declare module 'fs-extra';
