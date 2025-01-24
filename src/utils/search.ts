export function Search(query: string) {
  const engine =
    localStorage.getItem('@lunar/engine') || 'https://www.google.com/search?q=';
  if (validateUrl(query)) {
    if (!query.startsWith('https://') && !query.startsWith('http://')) {
      return `https://${query}`;
    }
    return query;
  }
  return engine + encodeURIComponent(query);
}

function validateUrl(url: string): boolean {
  const urlPattern = /^(https?:\/\/)?[^\s.]+\.[^\s]+$/;
  return urlPattern.test(url);
}
