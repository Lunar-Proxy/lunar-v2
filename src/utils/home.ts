interface Message {
  type: string;
  text: string;
}

interface Data {
  messages: Message[];
}

interface CloakDetails {
  name: string;
  url: string;
  favicon: string;
}

import { Settings } from '@src/utils/config';

const engine = await Settings.get('engine');
const favicon = document.getElementById('favicon') as HTMLImageElement;

if (engine === 'https://duckduckgo.com/?q=') {
  favicon.src = 'assets/images/engines/ddg.png';
} else {
  favicon.src = 'assets/images/engines/google.png';
}

let cloak: CloakDetails[] = [];

if (await Settings.get('PreventClosing')) {
  window.addEventListener('beforeunload', (event) => {
    event.preventDefault();
    // @ts-ignore
    return (event.returnValue = '');
  });
}

async function fetchData(): Promise<void> {
  try {
    const response = await fetch('/assets/json/tab.json');
    if (!response.ok) {
      throw new Error(`[ERROR] HTTP error, status: ${response.status}`);
    }
    cloak = await response.json();
    if (!Array.isArray(cloak)) {
      throw new Error('[ERROR] Invalid JSON structure: Expected an array');
    }
  } catch (error) {
    throw new Error(`[ERROR] Error reading JSON file: ${error}`);
  }
}

async function Cloak(): Promise<void> {
  let inFrame: boolean;

  try {
    inFrame = window !== top;
  } catch {
    inFrame = true;
  }

  if (!inFrame && !navigator.userAgent.includes('Firefox')) {
    const popup = window.open('about:blank');

    if (!popup || popup.closed) {
      alert('Allow popups/redirects to avoid the website showing in history.');
      return;
    }

    try {
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
      iframe.src = location.href;
      window.location.replace(item.url);
    } catch (error) {
      alert(`Error: ${error}`);
    }
  }
}

(async function initialize() {
  try {
    await fetchData();
    const status = await Settings.get('cloak');
    if (status === 'on') {
      await Cloak();
    } else {
      console.debug('[DEBUG] Cloaking is off. Enable cloaking in settings.');
    }
  } catch (error) {
    throw new Error(`[ERROR] Initialization failed: ${error}`);
  }
})();

fetch('/assets/json/quotes.json')
  .then((response) => {
    if (!response.ok) {
      throw new Error(`[DEBUG] HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then((data: Data) => {
    const messages = data.messages;
    if (!messages || messages.length === 0) {
      throw new Error('[ERROR] No messages found in JSON.');
    }
    const random = Math.floor(Math.random() * messages.length);
    const message = messages[random];
    const quote = document.getElementById('quote') as HTMLDivElement;
    if (quote && message && message.text) {
      quote.innerHTML = message.text;
    }
  })
  .catch((error) => {
    throw new Error(`[ERROR] error: ${error}`);
  });
