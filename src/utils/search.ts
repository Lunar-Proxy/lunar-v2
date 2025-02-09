import { Settings } from '@src/utils/config';

export async function Search(query: string) {
  const engine = await Settings.get('engine');

  if (validateUrl(query) || isDomain(query)) {
    return query.startsWith('http://') || query.startsWith('https://')
      ? query
      : `https://${query}`;
  }

  return `${engine}${encodeURIComponent(query)}`;
}

function validateUrl(url: string): boolean {
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/.test(url);
}

function isDomain(query: string): boolean {
  return /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(query);
}
