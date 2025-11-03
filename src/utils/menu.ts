import ConfigAPI from './config';
import { TabManager } from './tb';

document.addEventListener('DOMContentLoaded', () => {
  const menu = document.querySelector<HTMLButtonElement>('#menubtn');
  const cmenu = document.querySelector<HTMLDivElement>('#menu');
  const menuItems = Array.from(document.querySelectorAll<HTMLButtonElement>('#menu .menu-item'));

  if (!menu || !cmenu || menuItems.length === 0) return;

  const fullscreen = menuItems[1] ?? null;
  const inspectElement = menuItems[2] ?? null;
  const panic = menuItems[3] ?? null;
  const keybinds: Record<string, string> = {
    //clock: "ctrl+alt+h", history is coming soon
    'maximize-2': 'ctrl+alt+f',
    code: 'ctrl+alt+i',
    'log-out': '`',
  };

  const hideMenu = (): void => cmenu.classList.add('hidden');

  const toggleMenu = (e: MouseEvent): void => {
    e.stopPropagation();
    cmenu.classList.toggle('hidden');
  };

  const getActiveFrame = (): HTMLIFrameElement | null => {
    const id = `frame-${TabManager.activeTabId}`;
    const frame = document.getElementById(id);
    return frame instanceof HTMLIFrameElement ? frame : null;
  };

  menu.addEventListener('click', toggleMenu);

  document.addEventListener('click', e => {
    const target = e.target as Node | null;
    if (!target) return;
    if (!menu.contains(target) && !cmenu.contains(target)) hideMenu();
  });

  window.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement instanceof HTMLIFrameElement) hideMenu();
    }, 0);
  });

  cmenu.querySelectorAll<HTMLButtonElement>('.menu-item').forEach(item => {
    item.addEventListener('click', hideMenu);
  });

  fullscreen?.addEventListener('click', () => {
    const doc = window.top?.document;
    if (!doc) return;

    if (!doc.fullscreenElement) {
      void doc.documentElement.requestFullscreen().catch(() => {});
    } else {
      void doc.exitFullscreen().catch(() => {});
    }
  });

  inspectElement?.addEventListener('click', () => {
    const frame = getActiveFrame();
    if (!frame || !frame.contentWindow) return;

    try {
      const win = frame.contentWindow as any;
      const eruda = win.eruda;

      if (eruda && eruda._isInit) {
        eruda.destroy();
        return;
      }

      if (eruda && !eruda._isInit) {
        eruda.init();
        return;
      }

      const script = frame.contentDocument?.createElement('script');
      if (!script) return;

      script.src = 'https://cdn.jsdelivr.net/npm/eruda';
      script.async = true;
      script.onload = () => {
        try {
          win.eruda.init();
        } catch (e) {
          console.error('Could not start Eruda:', e);
        }
      };
      // @ts-ignore
      frame.contentDocument.head.appendChild(script);
    } catch (e) {
      console.error('Failed to inject Eruda:', e);
    }
  });

  panic?.addEventListener('click', async () => {
    let panicLoc = 'https://google.com';
    try {
      const ploc = await ConfigAPI.get('panicLoc');
      // @ts-ignore
      if (ploc) panicLoc = ploc;
    } catch {}
    window.top?.location.replace(panicLoc);
  });

  const keyMap = new Map<string, HTMLButtonElement>();

  for (const item of menuItems) {
    const icon = item.querySelector<SVGElement>('svg[data-lucide]');
    const iconName = icon?.getAttribute('data-lucide');
    if (!iconName) continue;

    const combo = keybinds[iconName];
    if (!combo) continue;

    const label = item.querySelector('span');
    if (label) {
      label.textContent = `${label.textContent} (${combo})`;
    }
    keyMap.set(combo.toLowerCase(), item);
  }

  document.addEventListener('keydown', e => {
    const combo = [
      e.ctrlKey ? 'ctrl' : '',
      e.altKey ? 'alt' : '',
      e.shiftKey ? 'shift' : '',
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
