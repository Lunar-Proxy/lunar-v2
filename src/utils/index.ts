import ConfigAPI from './config';
import { SettingsManager } from './st';
import './devconsole';

await ConfigAPI.init();
await SettingsManager.init();
