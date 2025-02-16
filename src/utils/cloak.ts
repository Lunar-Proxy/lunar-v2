declare global {
  interface Window {
    Cloak: () => Promise<void>;
  }
}

export async function Cloak(): Promise<void> {
  if (!navigator.userAgent.includes('Firefox')) {
    const popup = window.open('about:blank');

    if (!popup || popup.closed) {
      alert('Allow popups/redirects to avoid the website showing in history.');
      return;
    }

    try {
      const response = await fetch('/assets/json/tab.json');
      if (!response.ok)
        throw new Error(`[ERROR] HTTP error, status: ${response.status}`);

      const cloak = await response.json();
      if (!Array.isArray(cloak))
        throw new Error('[ERROR] Invalid JSON structure: Expected an array');

      const item = cloak[Math.floor(Math.random() * cloak.length)];
      const doc = popup.document;
      const iframe = doc.createElement('iframe');

      Object.assign(iframe.style, {
        position: 'fixed',
        top: '0',
        bottom: '0',
        left: '0',
        right: '0',
        border: 'none',
        outline: 'none',
        width: '100%',
        height: '100%',
      });

      const link =
        (document.querySelector("link[rel='icon']") as HTMLLinkElement) ||
        document.createElement('link');
      link.rel = 'icon';
      link.href = item.favicon;
      doc.head.appendChild(link);
      doc.title = item.name;
      doc.body.appendChild(iframe);
      iframe.src = window.location.origin;
      top?.window.location.replace(item.url);
    } catch (error) {
      alert(`Error: ${error}`);
    }
  }
}
