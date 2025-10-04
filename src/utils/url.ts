import ConfigAPI from './config';

export async function ValidateUrl(url: string) {
  const hasProtocol = url.startsWith('http://') || url.startsWith('https://');
  const engine = await ConfigAPI.get('engine');

  const isUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  if (isUrl(url) && hasProtocol) return url;
  if (url.includes('.') && !hasProtocol) return 'https://' + url;

  return `${engine}${encodeURIComponent(url)}`;
}
