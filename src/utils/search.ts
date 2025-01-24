export function Search(query: string) {
  const engine =
    localStorage.getItem('@lunar/engine') || 'https://www.google.com/search?q=';
  const backend = localStorage.getItem('@lunar/backend') || 'uv';
  let url;
  if (!validateUrl(query)) {
    return (url = engine + query);
  } else if (!(query.startsWith('https://') || query.startsWith('http://'))) {
    return (url = `https://${query}`);
  } else {
    return (url = query);
  }
}

function validateUrl(url: string) {
  return /^https?:\/\//.test(url) || (/\./.test(url) && !/\s/.test(url));
}
