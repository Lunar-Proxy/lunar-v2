import ConfigAPI from './config';

export async function Search(query: string) {
  const engine = await ConfigAPI.get('engine');

  if (isValidURL(query)) return query;
  if (isDomain(query)) return `https://${query}`;
  return `${engine}${encodeURIComponent(query)}`;
}

function isValidURL(query: string): boolean {
  try {
    new URL(query);
    return true;
  } catch {
    return false;
  }
}

function isDomain(query: string): boolean {
  return /^[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/.test(query);
}