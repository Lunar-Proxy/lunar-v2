import ConfigAPI from './config';

export class SettingsManager {
  private static panicHandler: (e: KeyboardEvent) => void = () => {};
  static async enable(key: string) {
    await ConfigAPI.set(key, 'on');
  }
  static async disable(key: string) {
    await ConfigAPI.set(key, 'off');
  }
  static async isEnabled(key: string) {
    const val = await ConfigAPI.get(key);
    return val === 'on' || val === true || val === 1;
  }
  static async load() {
    const keys = [
      'cloak',
      'cloakTitle',
      'cloakFavicon',
      'tabSwitchCloak',
      'autoCloak',
      'beforeUnload',
      'backend',
      'adBlock',
      'engine',
      'wispUrl',
      'panicLoc',
      'panicKey',
      'panicKeyBind',
    ] as const;
    const settings: Record<string, any> = {};
    for (const key of keys) {
      settings[key] = await ConfigAPI.get(key);
    }
    return settings;
  }
  static notify() {
    const el = document.querySelector('[data-notification]');
    if (!el) return;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 2000);
  }
  static async reset() {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) return;
    await ConfigAPI.reset();
    parent.location.reload();
  }
  static setCloak(on: boolean, title?: string, icon?: string) {
    const doc = (window.top || window).document;
    if (on) {
      doc.title = title || 'Google';
      let link = doc.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = doc.createElement('link');
        link.rel = 'icon';
        doc.head.appendChild(link);
      }
      link.href = icon || 'https://www.google.com/favicon.ico';
    } else {
      doc.title = 'Lunar v2';
      const link = doc.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) link.href = '/favicon.ico';
    }
  }
  static handleAutoCloak = async () => {
    if ((await ConfigAPI.get('cloak')) === 'on') return;
    const doc = (window.top || window).document;
    if (doc.hidden) {
      SettingsManager.setCloak(
        true,
        (await ConfigAPI.get('cloakTitle')) as string,
        (await ConfigAPI.get('cloakFavicon')) as string
      );
    } else {
      SettingsManager.setCloak(false);
    }
  };
  static initAutoCloak(on: boolean) {
    const doc = (window.top || window).document;
    doc.removeEventListener('visibilitychange', this.handleAutoCloak);
    if (on) doc.addEventListener('visibilitychange', this.handleAutoCloak);
  }
  static handleExit = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    (e as any).returnValue = '';
    return '';
  };
  static initExitPrompt(on: boolean) {
    const win = window.top || window;
    win.removeEventListener('beforeunload', this.handleExit);
    if (on) win.addEventListener('beforeunload', this.handleExit);
  }
  static formatKeybind(combo: string) {
    return combo
      .split('+')
      .map(p => {
        if (p === 'ctrl') return 'Ctrl';
        if (p === 'alt') return 'Alt';
        if (p === 'shift') return 'Shift';
        if (p === 'meta') return 'Meta';
        return p.length === 1 ? p.toUpperCase() : p;
      })
      .join('+');
  }
  static setPanicKey(combo: string) {
    const doc = (window.top || window).document;
    doc.removeEventListener('keydown', this.panicHandler);
    this.panicHandler = async (e: KeyboardEvent) => {
      const parts = [];
      if (e.ctrlKey) parts.push('ctrl');
      if (e.altKey) parts.push('alt');
      if (e.shiftKey) parts.push('shift');
      if (e.metaKey) parts.push('meta');
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) parts.push(e.key.toLowerCase());
      if (parts.join('+') === combo) {
        e.preventDefault();
        const url = (await ConfigAPI.get('panicLoc')) as string;
        if (url) (window.top || window).location.href = url;
      }
    };
    doc.addEventListener('keydown', this.panicHandler);
  }
  static highlightEngine(btn: Element) {
    btn.classList.add('bg-[#6366f1]/15', 'border-[#6366f1]/50');
    const check = btn.querySelector('.engine-check');
    if (check) check.classList.remove('hidden');
  }
  static unhighlightEngine(btn: Element) {
    btn.classList.remove('bg-[#6366f1]/15', 'border-[#6366f1]/50');
    const check = btn.querySelector('.engine-check');
    if (check) check.classList.add('hidden');
  }
  static highlightProxy(btn: Element) {
    btn.classList.add('border-[#6366f1]', 'bg-[#6366f1]/10');
    const check = btn.querySelector('.proxy-check');
    if (check) check.classList.remove('hidden');
  }
  static unhighlightProxy(btn: Element) {
    btn.classList.remove('border-[#6366f1]', 'bg-[#6366f1]/10');
    const check = btn.querySelector('.proxy-check');
    if (check) check.classList.add('hidden');
  }
  static highlightTransport(btn: Element) {
    btn.classList.add('border-[#6366f1]', 'bg-[#6366f1]/10');
    const check = btn.querySelector('.proxy-check');
    if (check) check.classList.remove('hidden');
  }
  static unhighlightTransport(btn: Element) {
    btn.classList.remove('border-[#6366f1]', 'bg-[#6366f1]/10');
    const check = btn.querySelector('.proxy-check');
    if (check) check.classList.add('hidden');
  }
  static initTransport() {
    const buttons = document.querySelectorAll('[data-transport]');
    const update = (val: string) => {
      buttons.forEach(btn => {
        if (btn.getAttribute('data-transport') === val) {
          SettingsManager.highlightTransport(btn);
        } else {
          SettingsManager.unhighlightTransport(btn);
        }
      });
    };
    buttons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.getAttribute('data-transport');
        if (name === 'ep') {
          await ConfigAPI.set('transport', 'ep');
          update('ep');
        } else if (name === 'lc') {
          await ConfigAPI.set('transport', 'lc');
          update('lc');
        }
        this.notify();
      });
    });
    ConfigAPI.get('transport').then(val => update(val === 'lc' ? 'lc' : 'ep'));
  }
  static initNav() {
    const items = document.querySelectorAll('[data-nav]');
    const activate = (item: Element, target: string) => {
      items.forEach(n => {
        n.classList.remove('bg-[#6366f1]/10', 'text-[#6366f1]');
        n.classList.add('text-text-secondary');
      });
      item.classList.remove('text-text-secondary');
      item.classList.add('bg-[#6366f1]/10', 'text-[#6366f1]');
      const section = document.querySelector(`[data-section="${target}"]`);
      if (!section) return;
      window.scrollTo({
        top: section.getBoundingClientRect().top + window.pageYOffset - 20,
        behavior: 'smooth',
      });
      try {
        history.replaceState(null, '', `#${target}`);
      } catch (_) {}
    };
    items.forEach(item => {
      item.addEventListener('click', (e: Event) => {
        e.preventDefault();
        activate(item, item.getAttribute('data-nav') || '');
      });
    });
    const hash = (window.location.hash || '').replace('#', '');
    if (hash) {
      const match = Array.from(items).find(i => i.getAttribute('data-nav') === hash);
      if (match) activate(match, hash);
    }
  }
  static initScrollSpy() {
    const sections = document.querySelectorAll('[data-section]');
    const items = document.querySelectorAll('[data-nav]');
    let active = 'privacy';
    let ticking = false;
    const update = () => {
      let current = 'privacy';
      let last: Element | null = null;
      sections.forEach(section => {
        if (section.getBoundingClientRect().top <= 120)
          current = section.getAttribute('data-section') || current;
        last = section;
      });
      const root = document.documentElement as HTMLElement | null;
      if (root && window.innerHeight + window.scrollY >= root.scrollHeight - 2) {
        current = (last as unknown as Element)?.getAttribute('data-section') || current;
      }
      if (current !== active) {
        active = current;
        items.forEach(item => {
          if (item.getAttribute('data-nav') === active) {
            item.classList.remove('text-text-secondary');
            item.classList.add('bg-[#6366f1]/10', 'text-[#6366f1]');
          } else {
            item.classList.remove('bg-[#6366f1]/10', 'text-[#6366f1]');
            item.classList.add('text-text-secondary');
          }
        });
      }
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    });
  }
  static initToggles() {
    document.querySelectorAll('.toggle').forEach(toggle => {
      toggle.addEventListener('click', async () => {
        toggle.classList.toggle('active');
        const key = toggle.getAttribute('data-toggle');
        const on = toggle.classList.contains('active');
        if (!key) return;
        if (on) await this.enable(key);
        else await this.disable(key);
        if (key === 'adBlock' && navigator.serviceWorker) {
          const msg = { type: 'ADBLOCK', data: { enabled: on } };
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage(msg);
          } else {
            navigator.serviceWorker.ready.then(reg => reg.active?.postMessage(msg));
          }
        }
        if (key === 'cloak') {
          const titleIn = document.querySelector('[data-input="cloakTitle"]') as HTMLInputElement;
          const iconIn = document.querySelector('[data-input="cloakFavicon"]') as HTMLInputElement;
          if (titleIn) titleIn.disabled = !on;
          if (iconIn) iconIn.disabled = !on;
          this.setCloak(on, titleIn?.value, iconIn?.value);
          if (on) {
            const sw = document.querySelector('[data-toggle="tabSwitchCloak"]');
            if (sw?.classList.contains('active')) {
              sw.classList.remove('active');
              await this.disable('tabSwitchCloak');
              this.initAutoCloak(false);
            }
          }
        }
        if (key === 'tabSwitchCloak') {
          if (on) {
            const cl = document.querySelector('[data-toggle="cloak"]');
            if (cl?.classList.contains('active')) {
              cl.classList.remove('active');
              await this.disable('cloak');
              const titleIn = document.querySelector(
                '[data-input="cloakTitle"]'
              ) as HTMLInputElement;
              const iconIn = document.querySelector(
                '[data-input="cloakFavicon"]'
              ) as HTMLInputElement;
              if (titleIn) titleIn.disabled = true;
              if (iconIn) iconIn.disabled = true;
              this.setCloak(false);
            }
          }
          this.initAutoCloak(on);
        }
        if (key === 'beforeUnload') this.initExitPrompt(on);
        if (key === 'autoCloak') this.initAutoCloak(on);
        if (key === 'panicKey') {
          const locIn = document.querySelector('[data-input="panicLoc"]') as HTMLInputElement;
          const keyIn = document.querySelector('[data-input="panicKeyBind"]') as HTMLInputElement;
          if (locIn) locIn.disabled = !on;
          if (keyIn) keyIn.disabled = !on;
          if (!on) {
            const doc = (window.top || window).document;
            doc.removeEventListener('keydown', this.panicHandler);
          } else {
            const combo = (await ConfigAPI.get('panicKeyBind')) as string;
            if (combo) this.setPanicKey(combo);
          }
        }
        this.notify();
      });
    });
  }
  static async saveInput(el: HTMLInputElement) {
    const key = el.getAttribute('data-input');
    if (!key || !el.value) return;
    await ConfigAPI.set(key, el.value);
    this.notify();
    if (key === 'wispUrl') el.placeholder = el.value;
    if (key === 'cloakTitle' || key === 'cloakFavicon') {
      const toggle = document.querySelector('[data-toggle="cloak"]');
      if (toggle?.classList.contains('active')) {
        this.setCloak(
          true,
          (document.querySelector('[data-input="cloakTitle"]') as HTMLInputElement)?.value,
          (document.querySelector('[data-input="cloakFavicon"]') as HTMLInputElement)?.value
        );
      }
    }
    if (key === 'engine') {
      const matched = Array.from(document.querySelectorAll('[data-engine]')).some(
        b => b.getAttribute('data-engine') === el.value
      );
      if (!matched)
        document.querySelectorAll('[data-engine]').forEach(b => this.unhighlightEngine(b));
    }
  }
  static initInputs() {
    document.querySelectorAll('[data-input]').forEach(input => {
      input.addEventListener('blur', (e: Event) => this.saveInput(e.target as HTMLInputElement));
      input.addEventListener('keydown', (e: Event) => {
        if ((e as KeyboardEvent).key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      });
    });
  }
  static initEngines() {
    document.querySelectorAll('[data-engine]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.getAttribute('data-engine');
        if (!url) return;
        await ConfigAPI.set('engine', url);
        const input = document.querySelector('[data-input="engine"]') as HTMLInputElement;
        if (input) input.value = url;
        document.querySelectorAll('[data-engine]').forEach(b => this.unhighlightEngine(b));
        this.highlightEngine(btn);
        this.notify();
      });
    });
  }
  static initProxyBackend() {
    const buttons = document.querySelectorAll('[data-proxy]');
    const update = (val: string) => {
      buttons.forEach(btn => {
        const type = btn.getAttribute('data-proxy');
        const active =
          (type === 'ultraviolet' && val === 'u') || (type === 'scramjet' && val === 'sc');
        if (active) this.highlightProxy(btn);
        else this.unhighlightProxy(btn);
      });
    };
    buttons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const val = btn.getAttribute('data-proxy') === 'ultraviolet' ? 'u' : 'sc';
        await ConfigAPI.set('backend', val);
        update(val);
        this.notify();
      });
    });
    ConfigAPI.get('backend').then(val => update(val === 'u' ? 'u' : 'sc'));
  }
  static initPresets() {
    document.querySelectorAll('[data-cloak-preset]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const title = btn.getAttribute('data-preset-title');
        const icon = btn.getAttribute('data-preset-favicon');
        if (!title || !icon) return;
        const titleIn = document.querySelector('[data-input="cloakTitle"]') as HTMLInputElement;
        const iconIn = document.querySelector('[data-input="cloakFavicon"]') as HTMLInputElement;
        if (titleIn) titleIn.value = title;
        if (iconIn) iconIn.value = icon;
        await ConfigAPI.set('cloakTitle', title);
        await ConfigAPI.set('cloakFavicon', icon);
        if (document.querySelector('[data-toggle="cloak"]')?.classList.contains('active')) {
          this.setCloak(true, title, icon);
        }
        this.notify();
      });
    });
  }
  static initPanicKey() {
    const input = document.querySelector('[data-input="panicKeyBind"]') as HTMLInputElement;
    if (!input) return;
    let recording = false;
    input.addEventListener('focus', () => {
      recording = true;
      input.value = 'Press keys...';
      input.classList.add('border-[#6366f1]/50', 'ring-2', 'ring-[#6366f1]/20');
    });
    input.addEventListener('keydown', async e => {
      if (!recording) return;
      e.preventDefault();
      e.stopPropagation();
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        const mods = [];
        if (e.ctrlKey) mods.push('Ctrl');
        if (e.altKey) mods.push('Alt');
        if (e.shiftKey) mods.push('Shift');
        if (e.metaKey) mods.push('Meta');
        input.value = mods.join('+') + '+';
        return;
      }
      const parts = [];
      if (e.ctrlKey) parts.push('ctrl');
      if (e.altKey) parts.push('alt');
      if (e.shiftKey) parts.push('shift');
      if (e.metaKey) parts.push('meta');
      parts.push(e.key.toLowerCase());
      const combo = parts.join('+');
      input.value = this.formatKeybind(combo);
      await ConfigAPI.set('panicKeyBind', combo);
      (window.top || window).dispatchEvent(new CustomEvent('panicKeyChanged', { detail: combo }));
      this.notify();
      this.setPanicKey(combo);
      parent.location.reload();
    });
    input.addEventListener('blur', () => {
      recording = false;
      input.classList.remove('border-[#6366f1]/50', 'ring-2', 'ring-[#6366f1]/20');
      if (input.value === 'Press keys...') {
        ConfigAPI.get('panicKeyBind').then(saved => {
          input.value = saved ? this.formatKeybind(saved as string) : '';
        });
      }
    });
  }
  static async apply(cfg: Record<string, any>) {
    const titleIn = document.querySelector('[data-input="cloakTitle"]') as HTMLInputElement;
    const iconIn = document.querySelector('[data-input="cloakFavicon"]') as HTMLInputElement;
    if (cfg.cloak === 'on') {
      document.querySelector('[data-toggle="cloak"]')?.classList.add('active');
      if (titleIn) titleIn.disabled = false;
      if (iconIn) iconIn.disabled = false;
      this.setCloak(true, cfg.cloakTitle, cfg.cloakFavicon);
    } else {
      if (titleIn) titleIn.disabled = true;
      if (iconIn) iconIn.disabled = true;
      this.setCloak(false);
    }
    if (cfg.tabSwitchCloak === 'on')
      document.querySelector('[data-toggle="tabSwitchCloak"]')?.classList.add('active');
    if (cfg.autoCloak === 'on') {
      document.querySelector('[data-toggle="autoCloak"]')?.classList.add('active');
      if (document.referrer === '') {
        this.setCloak(
          true,
          cfg.cloakTitle || 'Google',
          cfg.cloakFavicon || 'https://www.google.com/favicon.ico'
        );
      }
    }
    const adBlock = document.querySelector('[data-toggle="adBlock"]');
    if (adBlock) {
      if (cfg.adBlock === 'on') adBlock.classList.add('active');
      else adBlock.classList.remove('active');
    }
    if (cfg.beforeUnload === 'on')
      document.querySelector('[data-toggle="beforeUnload"]')?.classList.add('active');
    if (cfg.panicKey === 'on') {
      document.querySelector('[data-toggle="panicKey"]')?.classList.add('active');
      const locIn = document.querySelector('[data-input="panicLoc"]') as HTMLInputElement;
      const keyIn = document.querySelector('[data-input="panicKeyBind"]') as HTMLInputElement;
      if (locIn) locIn.disabled = false;
      if (keyIn) keyIn.disabled = false;
    }
    if (titleIn && cfg.cloakTitle) titleIn.value = cfg.cloakTitle;
    if (iconIn && cfg.cloakFavicon) iconIn.value = cfg.cloakFavicon;
    const engineIn = document.querySelector('[data-input="engine"]') as HTMLInputElement;
    if (engineIn && cfg.engine) engineIn.value = cfg.engine;
    const wispIn = document.querySelector('[data-input="wispUrl"]') as HTMLInputElement;
    if (wispIn) {
      const current = cfg.wispUrl || (await ConfigAPI.get('wispUrl'));
      wispIn.value = current || '';
      wispIn.placeholder = current || '';
    }
    const panicUrlIn = document.querySelector('[data-input="panicLoc"]') as HTMLInputElement;
    if (panicUrlIn && cfg.panicLoc) panicUrlIn.value = cfg.panicLoc;
    const panicKeyIn = document.querySelector('[data-input="panicKeyBind"]') as HTMLInputElement;
    if (panicKeyIn && cfg.panicKeyBind) {
      panicKeyIn.value = this.formatKeybind(cfg.panicKeyBind);
      this.setPanicKey(cfg.panicKeyBind);
    }
    if (cfg.engine) {
      document.querySelectorAll('[data-engine]').forEach(btn => {
        if (btn.getAttribute('data-engine') === cfg.engine) this.highlightEngine(btn);
      });
    }
    this.initAutoCloak(cfg.autoCloak === 'on');
    this.initExitPrompt(cfg.beforeUnload === 'on');
  }
  static async init() {
    const cfg = await this.load();
    await this.apply(cfg);
    if (cfg.adBlock === 'on' && navigator.serviceWorker) {
      const msg = { type: 'ADBLOCK', data: { enabled: true } };
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(msg);
      } else {
        navigator.serviceWorker.ready.then(reg => reg.active?.postMessage(msg));
      }
    }
    this.initNav();
    this.initScrollSpy();
    this.initToggles();
    this.initInputs();
    this.initEngines();
    this.initPresets();
    this.initProxyBackend();
    this.initTransport();
    this.initPanicKey();
    document.querySelector('[data-reset="reset"]')?.addEventListener('click', () => this.reset());
    document.querySelector('[data-reset="wisp"]')?.addEventListener('click', async () => {
      const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/w/`;
      await ConfigAPI.set('wispUrl', url);
      const wispIn = document.querySelector('[data-input="wispUrl"]') as HTMLInputElement;
      if (wispIn) {
        wispIn.value = url;
        wispIn.placeholder = url;
      }
      window.location.reload();
    });
    document.querySelector('[data-reset="engine"]')?.addEventListener('click', async () => {
      const fallback = 'https://duckduckgo.com/?q=';
      const buttons = document.querySelectorAll('[data-engine]');
      const target = Array.from(buttons).find(b => b.getAttribute('data-engine') === fallback)
        ? fallback
        : buttons[0]?.getAttribute('data-engine') || fallback;
      await ConfigAPI.set('engine', target);
      const input = document.querySelector('[data-input="engine"]') as HTMLInputElement;
      if (input) {
        input.value = target;
        input.placeholder = target;
      }
      buttons.forEach(b => {
        if (b.getAttribute('data-engine') === target) this.highlightEngine(b);
        else this.unhighlightEngine(b);
      });
      this.notify();
    });
  }
}
