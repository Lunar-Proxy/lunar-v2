import isUrl from 'is-url-superb';
import ConfigAPI from './config';

export async function ValidateUrl(url: string) {
  const protocolcheck = url.startsWith('http://') || url.startsWith('https://');
  const engine = await ConfigAPI.get('engine');
  if (isUrl(url) && protocolcheck) return url;
  if (url.includes('.') && !protocolcheck) {
    return 'https://' + url;
  }

  return engine + encodeURIComponent(url);
}
