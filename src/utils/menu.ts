import ConfigAPI from './config';
import { TabManager } from './tb';

document.addEventListener('DOMContentLoaded', async () => {
  const menu = document.querySelector<HTMLButtonElement>('#menubtn');
  const cmenu = document.querySelector<HTMLDivElement>('#menu');
  const menuItems = Array.from(document.querySelectorAll<HTMLButtonElement>('#menu .menu-item'));
  if (!menu || !cmenu || menuItems.length === 0) return;

  const [newTab, fullscreen, reload, inspectElement, cloak, panic, settings] = menuItems;
  let panicKeybind = ((await ConfigAPI.get('panicKey')) as string) || '';
  const keybinds: Record<string, string> = {
    plus: 'Ctrl+Alt+N',
    'maximize-2': 'Ctrl+Alt+F',
    'refresh-cw': 'Ctrl+Alt+R',
    code: 'Ctrl+Shift+I',
    settings: 'Ctrl+Alt+S',
    'log-out': panicKeybind,
    'hat-glasses': 'Ctrl+Alt+L',
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
    TabManager.openTab();
  });

  reload?.addEventListener('click', () => {
    const frame = getActiveFrame();
    if (!frame) return;
    frame.contentWindow?.location.reload();
  });

  settings?.addEventListener('click', () => {
    TabManager.openTab('./st');
  });

  cloak?.addEventListener('click', () => {
    const win = window.open();
    if (!win) return;
    if (top?.location.href === 'about:blank') {
      return;
    }

    const iframe = win.document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100vh';
    iframe.style.border = 'none';
    iframe.style.margin = '0';
    iframe.style.padding = '0';

    win.document.body.style.margin = '0';
    win.document.title = 'about:blank';

    iframe.src = window.location.origin + '/';
    win.document.body.appendChild(iframe);
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
      setTimeout(() => {
        try {
          // @ts-ignore
          window.top?.history.pushState(null, '', loc);
          window.top?.history.go(1);
        } catch {}
      }, 100);
    } catch {
      window.top?.location.replace('https://google.com');
      setTimeout(() => {
        try {
          window.top?.history.pushState(null, '', 'https://google.com');
          window.top?.history.go(1);
        } catch {}
      }, 100);
    }
  });

  const keyMap = new Map<string, HTMLButtonElement>();

  for (const item of menuItems) {
    const iconName = item.querySelector<SVGElement>('svg[data-lucide]')?.dataset.lucide;
    if (!iconName) continue;

    const combo = keybinds[iconName];
    if (!combo) continue;

    const label = item.querySelector('span');
    if (label && combo) {
      label.textContent = `${label.textContent} (${combo})`;
    }

    const normalized = combo.toLowerCase();
    if (normalized) {
      keyMap.set(normalized, item);
    }
  }

  document.addEventListener('keydown', e => {
    const parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    parts.push(e.key.toLowerCase());

    const combo = parts.join('+');
    const target = keyMap.get(combo);

    if (target) {
      e.preventDefault();
      target.click();
    }
  });
});
