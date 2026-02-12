import ConfigAPI from './config';
import { TabManager } from './tb';

interface MenuElements {
  menuButton: HTMLButtonElement;
  menuContainer: HTMLDivElement;
  newTab: HTMLButtonElement;
  fullscreen: HTMLButtonElement;
  darkmode: HTMLButtonElement;
  reload: HTMLButtonElement;
  inspectElement: HTMLButtonElement;
  cloak: HTMLButtonElement;
  panic: HTMLButtonElement;
  settings: HTMLButtonElement;
}

interface KeybindConfig {
  element: HTMLButtonElement;
  combo: string;
}

class MenuHandler {
  private elements: MenuElements;
  private keyMap = new Map<string, HTMLButtonElement>();
  private isMenuOpen = false;

  constructor(elements: MenuElements) {
    this.elements = elements;
  }

  async initialize(): Promise<void> {
    await this.setupKeybinds();
    this.attachEventListeners();
  }

  private async setupKeybinds(): Promise<void> {
    const panicKeybind = await this.getPanicKeybind();
    const keybindConfigs: KeybindConfig[] = [
      { element: this.elements.newTab, combo: 'Ctrl+Alt+N' },
      { element: this.elements.fullscreen, combo: 'Ctrl+Alt+Z' },
      { element: this.elements.reload, combo: 'Ctrl+Alt+R' },
      { element: this.elements.inspectElement, combo: 'Ctrl+Alt+I' },
      { element: this.elements.darkmode, combo: 'Ctrl+Alt+X' },
      { element: this.elements.cloak, combo: 'Ctrl+Alt+C' },
      { element: this.elements.panic, combo: panicKeybind },
      { element: this.elements.settings, combo: 'Ctrl+,' },
    ];
    for (const { element, combo } of keybindConfigs) {
      if (!combo) continue;
      this.addKeybindLabel(element, combo);
      this.keyMap.set(this.normalizeKeybind(combo), element);
    }
  }

  private async getPanicKeybind(): Promise<string> {
    try {
      return String((await ConfigAPI.get('panicKey')) ?? '');
    } catch {
      return '';
    }
  }

  private addKeybindLabel(element: HTMLButtonElement, combo: string): void {
    const label = element.querySelector('span');
    if (label) {
      label.textContent = `${label.textContent} (${combo})`;
    }
  }

  private normalizeKeybind(combo: string): string {
    return combo.toLowerCase().replace(/\s+/g, '');
  }

  private attachEventListeners(): void {
    const { menuButton, menuContainer } = this.elements;

    menuButton.addEventListener('click', this.toggleMenu.bind(this));
    document.addEventListener('click', this.handleDocumentClick.bind(this));
    document.addEventListener('mousedown', this.handleDocumentClick.bind(this));
    window.addEventListener('blur', this.handleWindowBlur.bind(this));
    
    menuContainer.querySelectorAll<HTMLButtonElement>('.menu-item').forEach(item => {
      item.addEventListener('click', this.hideMenu.bind(this));
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === 'Escape') this.hideMenu();
      });
    });
    
    this.setupMenuActions();
    window.addEventListener('keydown', this.handleKeydown.bind(this), true);
    document.addEventListener('keydown', this.handleKeydown.bind(this), true);
  }

  private setupMenuActions(): void {
    this.elements.newTab.addEventListener('click', () => TabManager.openTab());
    this.elements.reload.addEventListener('click', this.handleReload.bind(this));
    this.elements.settings.addEventListener('click', () => TabManager.openTab('./st'));
    this.elements.cloak.addEventListener('click', this.handleCloak.bind(this));
    this.elements.fullscreen.addEventListener('click', this.handleFullscreen.bind(this));
    this.elements.inspectElement.addEventListener('click', this.handleInspectElement.bind(this));
    this.elements.darkmode.addEventListener('click', this.handleDarkMode.bind(this));
    this.elements.panic.addEventListener('click', this.handlePanic.bind(this));
  }

  private toggleMenu(e: MouseEvent): void {
    e.stopPropagation();
    e.preventDefault();
    
    const wasHidden = this.elements.menuContainer.classList.contains('hidden');
    
    if (wasHidden) {
      this.showMenu();
    } else {
      this.hideMenu();
    }
  }

  private showMenu(): void {
    this.elements.menuContainer.classList.remove('hidden');
    this.isMenuOpen = true;
  }

  private hideMenu(): void {
    this.elements.menuContainer.classList.add('hidden');
    this.isMenuOpen = false;
  }

  private handleDocumentClick(e: MouseEvent): void {
    if (!this.isMenuOpen) return;

    const target = e.target as Node;
    const { menuButton, menuContainer } = this.elements;

    if (!menuButton.contains(target) && !menuContainer.contains(target)) {
      this.hideMenu();
    }
  }

  private handleWindowBlur(): void {
    requestAnimationFrame(() => {
      if (document.activeElement instanceof HTMLIFrameElement) {
        this.hideMenu();
      }
    });
  }

  private getActiveFrame(): HTMLIFrameElement | null {
    if (!TabManager?.activeTabId) return null;

    const frame = document.getElementById(`frame-${TabManager.activeTabId}`);
    return frame instanceof HTMLIFrameElement ? frame : null;
  }

  private handleReload(): void {
    const frame = this.getActiveFrame();
    if (frame?.contentWindow) {
      frame.contentWindow.location.reload();
    }
  }

  private handleDarkMode(): void {
    const frame = this.getActiveFrame();
    if (!frame?.contentWindow || !frame.contentDocument) return;
    
    const script = frame.contentDocument.createElement('script');
    script.textContent = `(() => {
      let style = document.getElementById('dark-mode');
      if (style) {
        style.parentNode.removeChild(style);
      } else {
        style = document.createElement('style');
        style.id = 'dark-mode';
        style.textContent = 'html { filter: invert(100%) hue-rotate(180deg); } iframe,img,object,video { filter: invert(90%) hue-rotate(180deg); }';
        document.head.appendChild(style);
      }
    })();`;
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
    const doc = window.top?.document;
    if (!doc) return;

    const promise = doc.fullscreenElement
      ? doc.exitFullscreen()
      : doc.documentElement.requestFullscreen();

    promise?.catch?.(() => {});
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
    } catch (error) {
      console.error('Failed to initialize inspector:', error);
    }
  }

  private async handlePanic(): Promise<void> {
    const panicLoc = await this.getConfigValue('panicLoc', 'https://google.com');
    const topWindow = window.top || window;
    topWindow.location.href = panicLoc;
  }

  private async getConfigValue(key: string, defaultValue: string): Promise<string> {
    try {
      return String((await ConfigAPI.get(key)) ?? defaultValue);
    } catch {
      return defaultValue;
    }
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.repeat) return;
    
    if (e.key === 'Escape' && this.isMenuOpen) {
      e.preventDefault();
      e.stopPropagation();
      this.hideMenu();
      return;
    }
    
    if (e.key === 'Enter' && this.elements.menuContainer.contains(document.activeElement)) {
      this.hideMenu();
      return;
    }
    
    const keybind = this.buildKeybind(e);
    const target = this.keyMap.get(keybind);
    
    if (target) {
      e.preventDefault();
      e.stopPropagation();
      target.click();
    }
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
  
  if (!menuButton || !menuContainer || menuItems.length < 8) {
    console.error('Required menu elements not found');
    return;
  }
  
  const [newTab, fullscreen, reload, inspectElement, darkmode, cloak, panic, settings] = menuItems;
  
  const elements: MenuElements = {
    menuButton,
    menuContainer,
    newTab,
    fullscreen,
    darkmode,
    reload,
    inspectElement,
    cloak,
    panic,
    settings,
  };
  
  const menuHandler = new MenuHandler(elements);
  await menuHandler.initialize();
});