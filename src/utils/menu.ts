import ConfigAPI from './config';
import { TabManager } from './tb';

document.addEventListener('DOMContentLoaded', () => {
  const menu = document.querySelector<HTMLButtonElement>('#menubtn');
  const cmenu = document.querySelector<HTMLDivElement>('#menu');
  const menuItems = Array.from(document.querySelectorAll<HTMLButtonElement>('#menu .menu-item'));
  if (!menu || !cmenu || menuItems.length === 0) return;

  const [newTab, fullscreen, reload, inspectElement, panic, settings] = menuItems;

  const keybinds: Record<string, string> = {
    plus: 'ctrl+alt+n',
    'maximize-2': 'ctrl+alt+f',
    'refresh-cw': 'ctrl+alt+x',
    code: 'ctrl+alt+i',
    settings: 'ctrl+alt+s',
    'log-out': '`',
  };

  const hideMenu = () => cmenu.classList.add('hidden');
  const toggleMenu = (e: MouseEvent) => {
    e.stopPropagation();
    cmenu.classList.toggle('hidden');
  };

  const getActiveFrame = (): HTMLIFrameElement | null => {
    const frame = document.getElementById(`frame-${TabManager.activeTabId}`);
    return frame instanceof HTMLIFrameElement ? frame : null;
  };

  menu.addEventListener('click', toggleMenu);

  document.addEventListener('click', e => {
    const target = e.target as Node | null;
    if (target && !menu.contains(target) && !cmenu.contains(target)) hideMenu();
  });

  window.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement instanceof HTMLIFrameElement) hideMenu();
    });
  });

  cmenu.querySelectorAll<HTMLButtonElement>('.menu-item').forEach(item => {
    item.addEventListener('click', hideMenu);
  });

  newTab?.addEventListener('click', () => {
    TabManager.addTab();
  });

  reload?.addEventListener('click', () => {
    const frame = getActiveFrame();
    if (!frame) return;
    frame.contentWindow?.location.reload();
  });

  settings?.addEventListener('click', () => {
    const frame = getActiveFrame();
    if (!frame) return;
    frame.contentWindow!.location.href = './st';
  });

  fullscreen?.addEventListener('click', () => {
    const doc = window.top?.document;
    if (!doc) return;
    const toggle = doc.fullscreenElement
      ? doc.exitFullscreen()
      : doc.documentElement.requestFullscreen();
    void toggle.catch(() => {});
  });

  inspectElement?.addEventListener('click', () => {
    const frame = getActiveFrame();
    if (!frame?.contentWindow) return;

    try {
      const win = frame.contentWindow as any;
      const eruda = win.eruda;

      if (eruda) {
        if (eruda._isInit) {
          eruda.destroy();
        } else {
          eruda.init();
        }
        return;
      }

      const script = frame.contentDocument?.createElement('script');
      if (!script) return;

      script.src = 'https://cdn.jsdelivr.net/npm/eruda';
      script.async = true;
      script.onload = () => {
        try {
          win.eruda.init();
        } catch (err) {
          console.error('Could not start Eruda:', err);
        }
      };
      frame.contentDocument?.head.appendChild(script);
    } catch (err) {
      console.error('Failed to inject Eruda:', err);
    }
  });

  panic?.addEventListener('click', async () => {
    try {
      const loc = (await ConfigAPI.get('panicLoc')) || 'https://google.com';
      // @ts-ignore
      window.top?.location.replace(loc);
    } catch {
      window.top?.location.replace('https://google.com');
    }
  });

  const keyMap = new Map<string, HTMLButtonElement>();

  for (const item of menuItems) {
    const iconName = item.querySelector<SVGElement>('svg[data-lucide]')?.dataset.lucide;
    if (!iconName) continue;

    const combo = keybinds[iconName];
    if (!combo) continue;

    const label = item.querySelector('span');
    if (label) label.textContent = `${label.textContent} (${combo})`;

    keyMap.set(combo.toLowerCase(), item);
  }

  document.addEventListener('keydown', e => {
    const combo = [
      e.ctrlKey && 'ctrl',
      e.altKey && 'alt',
      e.shiftKey && 'shift',
      e.key.toLowerCase(),
    ]
      .filter(Boolean)
      .join('+');

    const target = keyMap.get(combo);
    if (target) {
      e.preventDefault();
      target.click();
    }
  });
});
