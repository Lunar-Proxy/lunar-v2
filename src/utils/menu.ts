import { createIcons, icons } from 'lucide';
import ConfigAPI from './config';
import { TabManager } from './tb';

interface MenuElements {
  menuButton: HTMLButtonElement;
  menuContainer: HTMLDivElement;
  newTab: HTMLButtonElement;
  fullscreen: HTMLButtonElement;
  darkmode: HTMLButtonElement;
  reload: HTMLButtonElement;
  games: HTMLButtonElement;
  inspectElement: HTMLButtonElement;
  cloak: HTMLButtonElement;
  panic: HTMLButtonElement;
  settings: HTMLButtonElement;
}

interface KeybindConfig {
  element: HTMLButtonElement;
  combo: string;
  label: string;
}

class MenuHandler {
  private elements: MenuElements;
  private keyMap = new Map<string, HTMLButtonElement>();
  private isOpen = false;
  private darkModeActive = false;
  private outsideListener: ((e: MouseEvent) => void) | null = null;
  private iframeOverlay: HTMLDivElement | null = null;

  constructor(elements: MenuElements) {
    this.elements = elements;
  }

  async initialize(): Promise<void> {
    await this.setupKeybinds();
    this.attachEventListeners();
  }

  private async setupKeybinds(): Promise<void> {
    const panicKeybind = await this.getPanicKeybind();
    const configs: KeybindConfig[] = [
      { element: this.elements.newTab, combo: 'Ctrl+Alt+N', label: 'Ctrl+Alt+N' },
      { element: this.elements.fullscreen, combo: 'Ctrl+Alt+Z', label: 'Ctrl+Alt+Z' },
      { element: this.elements.reload, combo: 'Ctrl+Alt+R', label: 'Ctrl+Alt+R' },
      { element: this.elements.inspectElement, combo: 'Ctrl+Alt+I', label: 'Ctrl+Alt+I' },
      { element: this.elements.darkmode, combo: 'Ctrl+Alt+X', label: 'Ctrl+Alt+X' },
      { element: this.elements.cloak, combo: 'Ctrl+Alt+C', label: 'Ctrl+Alt+C' },
      { element: this.elements.panic, combo: panicKeybind, label: panicKeybind },
      { element: this.elements.settings, combo: 'Ctrl+,', label: 'Ctrl+,' },
    ];

    for (const { element, combo, label } of configs) {
      if (!combo) continue;
      this.addKeybindBadge(element, label);
      this.keyMap.set(this.normalizeKeybind(combo), element);
    }
  }

  private async getPanicKeybind(): Promise<string> {
    try {
      return String((await ConfigAPI.get('panicKeyBind')) ?? '');
    } catch {
      return '';
    }
  }

  private addKeybindBadge(element: HTMLButtonElement, label: string): void {
    if (!label) return;
    const badge = document.createElement('span');
    badge.className =
      'ml-auto shrink-0 text-[10px] text-gray-600 bg-white/5 rounded px-1 py-0.5 font-mono leading-none';
    badge.textContent = label;
    element.appendChild(badge);
  }

  private normalizeKeybind(combo: string): string {
    return combo.toLowerCase().replace(/\s+/g, '');
  }

  private attachEventListeners(): void {
    this.elements.menuButton.addEventListener('click', this.toggleMenu.bind(this));
    this.setupMenuActions();
    window.addEventListener('keydown', e => void this.handleKeydown(e), true);
  }

  private setupMenuActions(): void {
    this.elements.newTab.addEventListener('click', () => {
      TabManager.openTab();
      this.hideMenu();
    });

    this.elements.reload.addEventListener('click', () => {
      this.handleReload();
      this.hideMenu();
    });

    this.elements.games.addEventListener('click', () => {
      TabManager.openTab('./math');
      this.hideMenu();
    });

    this.elements.settings.addEventListener('click', () => {
      TabManager.openTab('./st');
      this.hideMenu();
    });

    this.elements.cloak.addEventListener('click', () => {
      this.handleCloak();
      this.hideMenu();
    });

    this.elements.fullscreen.addEventListener('click', () => {
      this.handleFullscreen();
      this.hideMenu();
    });

    this.elements.inspectElement.addEventListener('click', () => {
      this.handleInspectElement();
      this.hideMenu();
    });

    this.elements.darkmode.addEventListener('click', () => {
      this.handleDarkMode();
      this.darkModeActive = !this.darkModeActive;
      const span = this.elements.darkmode.querySelector('span');
      if (span) span.textContent = this.darkModeActive ? 'Light Mode' : 'Dark Mode';
      const icon = this.elements.darkmode.querySelector<HTMLElement>('[data-lucide]');
      if (icon) icon.setAttribute('data-lucide', this.darkModeActive ? 'sun' : 'moon');
      createIcons({ icons, nameAttr: 'data-lucide' });
      this.hideMenu();
    });

    this.elements.panic.addEventListener('click', () => {
      void this.handlePanic();
      this.hideMenu();
    });
  }

  private toggleMenu(e: MouseEvent): void {
    e.stopPropagation();
    this.isOpen ? this.hideMenu() : this.showMenu();
  }

  private showMenu(): void {
    const menu = this.elements.menuContainer;
    this.isOpen = true;
    menu.classList.remove('hidden', 'menu-closing');
    menu.classList.add('menu-opening');
    menu.querySelectorAll('.menu-item').forEach((el, i) => {
      (el as HTMLElement).style.animationDelay = `${0.04 + i * 0.026}s`;
    });

    if (!this.iframeOverlay) {
      const overlay = document.createElement('div');
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:40;background:transparent;cursor:default;';
      overlay.addEventListener('mousedown', () => this.hideMenu());
      document.body.appendChild(overlay);
      this.iframeOverlay = overlay;
    }

    if (this.outsideListener) {
      document.removeEventListener('mousedown', this.outsideListener, true);
    }

    this.outsideListener = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menu.contains(target) && !this.elements.menuButton.contains(target)) {
        this.hideMenu();
      }
    };
    document.addEventListener('mousedown', this.outsideListener, true);
  }

  private hideMenu(): void {
    const menu = this.elements.menuContainer;
    if (!this.isOpen) return;
    this.isOpen = false;

    if (this.iframeOverlay) {
      this.iframeOverlay.remove();
      this.iframeOverlay = null;
    }

    if (this.outsideListener) {
      document.removeEventListener('mousedown', this.outsideListener, true);
      this.outsideListener = null;
    }

    menu.classList.remove('menu-opening');
    menu.classList.add('menu-closing');
    menu.addEventListener(
      'animationend',
      () => {
        if (!this.isOpen) {
          menu.classList.add('hidden');
          menu.classList.remove('menu-closing');
        }
      },
      { once: true },
    );
  }

  private getActiveFrame(): HTMLIFrameElement | null {
    if (!TabManager?.activeTabId) return null;
    const frame = document.getElementById(`frame-${TabManager.activeTabId}`);
    return frame instanceof HTMLIFrameElement ? frame : null;
  }

  private handleReload(): void {
    const frame = this.getActiveFrame();
    if (frame?.contentWindow) frame.contentWindow.location.reload();
  }

  private handleDarkMode(): void {
    const frame = this.getActiveFrame();
    if (!frame?.contentWindow || !frame.contentDocument) return;
    const script = frame.contentDocument.createElement('script');
    script.textContent = `(() => { let s = document.getElementById('_dm'); if (s) { s.remove(); return; } s = document.createElement('style'); s.id = '_dm'; s.textContent = 'html{filter:invert(100%) hue-rotate(180deg)} iframe,img,object,video{filter:invert(90%) hue-rotate(180deg)}'; document.head.appendChild(s); })();`;
    frame.contentDocument.head.appendChild(script);
  }

  private async handleCloak(): Promise<void> {
    if (top?.location.href === 'about:blank') return;
    const newWindow = window.open();
    if (!newWindow) return;
    if (top?.window) {
      const panicLoc = await this.getConfigValue('panicLoc', 'https://google.com');
      top.window.location.href = panicLoc;
    }
    const iframe = newWindow.document.createElement('iframe');
    iframe.style.cssText = 'width:100%;height:100vh;border:0;margin:0;padding:0';
    iframe.src = `${location.origin}/`;
    newWindow.document.body.style.margin = '0';
    newWindow.document.title = 'about:blank';
    newWindow.document.body.appendChild(iframe);
  }

  private handleFullscreen(): void {
    const frame = this.getActiveFrame();
    const doc = frame?.contentDocument;
    if (!doc) return;
    const p = doc.fullscreenElement
      ? doc.exitFullscreen()
      : doc.documentElement.requestFullscreen();
    p?.catch?.(() => {});
  }

  private handleInspectElement(): void {
    const frame = this.getActiveFrame();
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
    } catch (err) {
      console.error('Inspector failed:', err);
    }
  }

  private async handlePanic(): Promise<void> {
    const panicKey = await this.getConfigValue('panicKey', 'on');
    if (panicKey !== 'on') return;
    const panicLoc = await this.getConfigValue('panicLoc', 'https://google.com');
    (window.top || window).location.href = panicLoc;
  }

  private async getConfigValue(key: string, fallback: string): Promise<string> {
    try {
      return String((await ConfigAPI.get(key)) ?? fallback);
    } catch {
      return fallback;
    }
  }

  private async handleKeydown(e: KeyboardEvent): Promise<void> {
    if (e.repeat) return;

    if (e.key === 'Escape' && this.isOpen) {
      e.preventDefault();
      e.stopPropagation();
      this.hideMenu();
      return;
    }

    const keybind = this.buildKeybind(e);
    const target = this.keyMap.get(keybind);
    if (!target) return;

    if (target === this.elements.panic) {
      const panicKey = await this.getConfigValue('panicKey', 'on');
      if (panicKey !== 'on') return;
    }

    e.preventDefault();
    e.stopPropagation();
    target.click();
  }

  private buildKeybind(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    let key = e.key.toLowerCase();
    if (key === ' ') key = 'space';
    parts.push(key);
    return parts.join('+');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const menuButton = document.querySelector<HTMLButtonElement>('#menubtn');
  const menuContainer = document.querySelector<HTMLDivElement>('#menu');
  const menuItems = Array.from(document.querySelectorAll<HTMLButtonElement>('#menu .menu-item'));

  if (!menuButton || !menuContainer) {
    console.error('Required menu elements not found');
    return;
  }

  const [newTab, fullscreen, reload, games, inspectElement, darkmode, cloak, panic, settings] =
    menuItems;

  const handler = new MenuHandler({
    menuButton,
    menuContainer,
    newTab,
    fullscreen,
    darkmode,
    reload,
    games,
    inspectElement,
    cloak,
    panic,
    settings,
  });

  await handler.initialize();
});
