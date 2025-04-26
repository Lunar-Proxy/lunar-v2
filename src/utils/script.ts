const frameNavigator = document.getElementById('frame') as HTMLIFrameElement;
const Navigation = [
  { btn: 'Home', url: './welcome' },
  { btn: 'Search', url: './browse' },
  { btn: 'Games', url: './gm' },
  { btn: 'Apps', url: './ap' },
  { btn: 'Settings', url: './st' },
];

import { AbCloak } from '../utils/ab';

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key === 'x') {
    console.log('[DEBUG] exit keybinds clicked');
    top?.window.location.replace('https://www.docs.google.com');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key === 'z') {
    console.log('[DEBUG] AB Cloak keybinds clicked');
    AbCloak();
  }
});

Navigation.forEach(({ btn, url }) => {
  const button =
    Array.from(document.querySelectorAll('span'))
      .find((el) => el.textContent?.trim() === btn)
      ?.previousElementSibling?.querySelector('button') || null;

  if (button) {
    button!.addEventListener('click', () => {
      if (frameNavigator) {
        frameNavigator.src = url;
      }
    });
  }
});
