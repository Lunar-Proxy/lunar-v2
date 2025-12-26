import ConfigAPI from './config';

export async function validateUrl(input: string): Promise<string> {
  const engine = await ConfigAPI.get('engine');
  const value = input.trim();

  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {}

  if (/^[\w-]+(\.[\w-]+)+/.test(value)) {
    return `https://${value}`;
  }

  return `${engine}${encodeURIComponent(value)}`;
}
