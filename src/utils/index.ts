import ConfigAPI from './config';
import { SettingsManager } from './st';

// fuck you GG
const orig = Event.prototype.stopImmediatePropagation;

Event.prototype.stopImmediatePropagation = function (...args: any[]) {
 if (this.type === 'beforeunload') return;
   // @ts-ignore
  return orig.apply(this, args);
};

await Promise.all([ConfigAPI.init(), SettingsManager.init()]);
