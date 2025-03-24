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

interface Window {
  sj: any;
  eruda: any;
}

declare module '@mercuryworkshop/epoxy-transport';
declare module '@mercuryworkshop/wisp-js/server';
declare module '@mercuryworkshop/bare-mux/node';
declare module '@mercuryworkshop/libcurl-transport';
