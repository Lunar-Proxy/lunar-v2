import ConfigAPI from './config';
import { SettingsManager } from './st';

await Promise.all([ConfigAPI.init(), SettingsManager.init()]);
