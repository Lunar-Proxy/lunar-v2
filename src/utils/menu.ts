import ConfigAPI from './config';
import { TabManager } from './tb';

document.addEventListener('DOMContentLoaded', async () => {
  const menu = document.querySelector<HTMLButtonElement>('#menubtn');
  const cmenu = document.querySelector<HTMLDivElement>('#menu');
  const menuItems = Array.from(document.querySelectorAll<HTMLButtonElement>('#menu .menu-item'));
  if (!menu || !cmenu || menuItems.length < 7) return;

  const [newTab, fullscreen, reload, inspectElement, cloak, panic, settings] = menuItems;

  let panicKeybind = '';
  try {
    panicKeybind = String((await ConfigAPI.get('panicKey')) ?? '');
  } catch {}

  const keybindMap: [HTMLButtonElement, string][] = [
    [newTab, 'Ctrl+T'],
    [fullscreen, 'F11'],
    [reload, 'Ctrl+R'],
    [inspectElement, 'Ctrl+Shift+I'],
    [cloak, 'Ctrl+Shift+B'],
    [panic, panicKeybind],
    [settings, 'Ctrl+,'],
  ];

  const keyMap = new Map<string, HTMLButtonElement>();

  for (const [item, combo] of keybindMap) {
    if (!combo) continue;
    const label = item.querySelector('span');
    if (label) label.textContent = `${label.textContent} (${combo})`;
    keyMap.set(combo.toLowerCase().replace(/\s+/g, ''), item);
  }

  const hideMenu = () => {
    cmenu.classList.add('hidden');
  };

  const toggleMenu = (e: MouseEvent) => {
    e.stopPropagation();
    cmenu.classList.toggle('hidden');
  };

  const getActiveFrame = (): HTMLIFrameElement | null => {
    if (!TabManager?.activeTabId) return null;
    const frame = document.getElementById(`frame-${TabManager.activeTabId}`);
    return frame instanceof HTMLIFrameElement ? frame : null;
  };

  menu.addEventListener('click', toggleMenu);

  document.addEventListener('click', e => {
    const t = e.target as Node;
    if (!menu.contains(t) && !cmenu.contains(t)) hideMenu();
  });

  window.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement instanceof HTMLIFrameElement) hideMenu();
    });
  });

  cmenu.querySelectorAll<HTMLButtonElement>('.menu-item').forEach(item => {
    item.addEventListener('click', hideMenu);
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter') hideMenu();
    });
  });

  newTab.addEventListener('click', () => {
    TabManager.openTab();
  });

  reload.addEventListener('click', () => {
    getActiveFrame()?.contentWindow?.location.reload();
  });

  settings.addEventListener('click', () => {
    TabManager.openTab('./st');
  });

  cloak.addEventListener('click', () => {
    if (top?.location.href === 'about:blank') return;
    const win = window.open();
    if (!win) return;

    const iframe = win.document.createElement('iframe');
    iframe.style.cssText = 'width:100%;height:100vh;border:0;margin:0;padding:0';
    iframe.src = location.origin + '/';

    win.document.body.style.margin = '0';
    win.document.title = 'about:blank';
    win.document.body.appendChild(iframe);
  });

  fullscreen.addEventListener('click', () => {
    const doc = window.top?.document;
    if (!doc) return;

    const p = doc.fullscreenElement
      ? doc.exitFullscreen()
      : doc.documentElement.requestFullscreen();

    p?.catch?.(() => {});
  });

  inspectElement.addEventListener('click', () => {
    const frame = getActiveFrame();
    if (!frame?.contentWindow || !frame.contentDocument) return;

    try {
      const win = frame.contentWindow as any;

      if (win.eruda) {
        win.eruda._isInit ? win.eruda.destroy() : win.eruda.init();
        return;
      }

      const script = frame.contentDocument.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/eruda';
      script.onload = () => win.eruda?.init?.();
      frame.contentDocument.head.appendChild(script);
    } catch {}
  });

  panic.addEventListener('click', async () => {
    let loc = 'https://google.com';
    try {
      loc = String((await ConfigAPI.get('panicLoc')) ?? loc);
    } catch {}

    const top = window.top || window;
    top.location.href = loc;
  });

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.repeat) return;

    if (e.key === 'Enter' && cmenu.contains(document.activeElement)) {
      hideMenu();
      return;
    }

    const parts: string[] = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');

    let key = e.key.toLowerCase();
    if (key === ' ') key = 'space';
    parts.push(key);

    const hit = parts.join('+');
    const target = keyMap.get(hit);
    if (!target) return;

    e.preventDefault();
    e.stopPropagation();
    target.click();
  };

  window.addEventListener('keydown', handleKeydown, true);
  document.addEventListener('keydown', handleKeydown, true);
});
