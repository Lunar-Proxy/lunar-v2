import isUrl from 'is-url-superb';
import ConfigAPI from './config';

export async function ValidateUrl(url: string) {
  const protocol = url.startsWith('http://') || url.startsWith('https://');
  const engine = await ConfigAPI.get('engine');
  if (isUrl(url) && protocol) return url;
  if (url.includes('.') && !protocol) {
    return 'https://' + url;
  }

  return engine + encodeURIComponent(url);
}
