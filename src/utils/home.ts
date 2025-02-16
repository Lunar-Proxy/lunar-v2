interface Message {
  type: string;
  text: string;
}

interface Data {
  messages: Message[];
}

import { Settings } from '@src/utils/config';

const engine = await Settings.get('engine');
const favicon = document.getElementById('favicon') as HTMLImageElement;

if (engine === 'https://duckduckgo.com/?q=') {
  favicon.src = 'assets/images/engines/ddg.png';
} else {
  favicon.src = 'assets/images/engines/google.png';
}

if (await Settings.get('PreventClosing')) {
  window.addEventListener('beforeunload', (event) => {
    event.preventDefault();
    // @ts-ignore
    return (event.returnValue = '');
  });
}

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
