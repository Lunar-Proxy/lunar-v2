import ConfigAPI from './config';

export const SettingsAPI = {
  async enable(key: string) {
    await ConfigAPI.set(key, 'on');
  },
  async disable(key: string) {
    await ConfigAPI.set(key, 'off');
  },
  async toggle(key: string) {
    const value = await ConfigAPI.get(key);
    const newValue = value === 'on' ? 'off' : 'on';
    await ConfigAPI.set(key, newValue);
    return newValue;
  },
  async isEnabled(key: string) {
    const value = await ConfigAPI.get(key);
    return value === 'on' || value === true || value === 1;
  },
  async loadAll() {
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
    ];
    const settings: Record<string, any> = {};
    for (const key of keys) {
      settings[key] = await ConfigAPI.get(key);
    }
    return settings;
  },
};

export interface SettingsConfig {
  cloak?: string;
  cloakTitle?: string;
  cloakFavicon?: string;
  tabSwitchCloak?: string;
  autoCloak?: string;
  beforeUnload?: string;
  backend?: string;
  adBlock?: string;
  engine?: string;
  wispUrl?: string;
  panicLoc?: string;
  panicKey?: string;
}

export class SettingsManager {
  static initProxyBackend() {
    const proxyButtons = document.querySelectorAll('[data-proxy]');
    function updateProxyUI(val: string) {
      proxyButtons.forEach(btn => {
        const type = btn.getAttribute('data-proxy');
        const isActive =
          (type === 'ultraviolet' && val === 'u') || (type === 'scramjet' && val === 'sc');
        if (isActive) {
          btn.classList.add('border-[#6366f1]', 'bg-[#6366f1]/10');
        } else {
          btn.classList.remove('border-[#6366f1]', 'bg-[#6366f1]/10');
        }
      });
    }
    proxyButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const type = btn.getAttribute('data-proxy');
        const val = type === 'ultraviolet' ? 'u' : 'sc';
        await ConfigAPI.set('backend', val);
        updateProxyUI(val);
        SettingsManager.notify();
      });
    });
    ConfigAPI.get('backend').then(val => {
      updateProxyUI(val === 'u' ? 'u' : 'sc');
    });
  }
  private static panicKeyHandler: (e: KeyboardEvent) => void = () => {};
  static async load() {
    return {
      cloak: (await ConfigAPI.get('cloak')) as string,
      cloakTitle: (await ConfigAPI.get('cloakTitle')) as string,
      cloakFavicon: (await ConfigAPI.get('cloakFavicon')) as string,
      tabSwitchCloak: (await ConfigAPI.get('tabSwitchCloak')) as string,
      autoCloak: (await ConfigAPI.get('autoCloak')) as string,
      beforeUnload: (await ConfigAPI.get('beforeUnload')) as string,
      backend: (await ConfigAPI.get('backend')) as string,
      adBlock: (await ConfigAPI.get('adBlock')) as string,
      engine: (await ConfigAPI.get('engine')) as string,
      wispUrl: (await ConfigAPI.get('wispUrl')) as string,
      panicLoc: (await ConfigAPI.get('panicLoc')) as string,
      panicKey: (await ConfigAPI.get('panicKey')) as string,
    };
  }

  static notify() {
    const notif = document.querySelector('[data-notification]');
    if (notif) {
      notif.classList.remove('hidden');
      setTimeout(() => notif.classList.add('hidden'), 2000);
    }
  }
  static async reset() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      await ConfigAPI.reset();
      location.reload();
    }
  }

  static initNav() {
    const items = document.querySelectorAll('[data-nav]');

    items.forEach(item => {
      item.addEventListener('click', () => {
        const target = item.getAttribute('data-nav');
        const section = document.querySelector(`[data-section="${target}"]`);

        if (section) {
          items.forEach(n => {
            n.classList.remove('bg-[#6366f1]/15', 'text-[#6366f1]');
            n.classList.add('text-text-secondary');
          });
          item.classList.remove('text-text-secondary');
          item.classList.add('bg-[#6366f1]/15', 'text-[#6366f1]');

          const y = section.getBoundingClientRect().top + window.pageYOffset - 20;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      });
    });
  }

  static initSearch() {
    const search = document.querySelector('[data-filter-input]') as HTMLInputElement;
    const sections = document.querySelectorAll('[data-section]');

    if (!search) return;

    search.addEventListener('input', e => {
      const q = (e.target as HTMLInputElement).value.toLowerCase().trim();

      if (!q) {
        sections.forEach(s => ((s as HTMLElement).style.display = 'block'));
        document.querySelectorAll('[class*="rounded-xl"]').forEach(c => {
          (c as HTMLElement).style.display = '';
        });
        return;
      }

      sections.forEach(section => {
        const cards = section.querySelectorAll('[class*="rounded-xl"]');
        let found = false;

        cards.forEach(card => {
          const title = card.querySelector('h3')?.textContent?.toLowerCase() || '';
          const desc = card.querySelector('p')?.textContent?.toLowerCase() || '';
          const label = card.querySelector('label')?.textContent?.toLowerCase() || '';
          const allText = card.textContent?.toLowerCase().replace(/\s+/g, ' ') || '';

          const match =
            title.includes(q) || desc.includes(q) || label.includes(q) || allText.includes(q);

          (card as HTMLElement).style.display = match ? '' : 'none';
          if (match) found = true;
        });

        (section as HTMLElement).style.display = found ? 'block' : 'none';
      });
    });
  }

  static initScrollSpy() {
    const sections = document.querySelectorAll('[data-section]');
    const items = document.querySelectorAll('[data-nav]');
    let scrolling = false;
    const obs = new IntersectionObserver(
      entries => {
        if (scrolling) return;

        let max = 0;
        let top: IntersectionObserverEntry | undefined;

        entries.forEach(e => {
          if (e.intersectionRatio > max) {
            max = e.intersectionRatio;
            top = e;
          }
        });

        if (top && top.isIntersecting) {
          const id = top.target.getAttribute('data-section');
          items.forEach(item => {
            if (item.getAttribute('data-nav') === id) {
              items.forEach(n => {
                n.classList.remove('bg-[#6366f1]/15', 'text-[#6366f1]');
                n.classList.add('text-text-secondary');
              });
              item.classList.remove('text-text-secondary');
              item.classList.add('bg-[#6366f1]/15', 'text-[#6366f1]');
            }
          });
        }
      },
      {
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        rootMargin: '-80px 0px -40% 0px',
      },
    );

    sections.forEach(s => obs.observe(s));

    items.forEach(item => {
      item.addEventListener('click', () => {
        scrolling = true;
        setTimeout(() => (scrolling = false), 1000);
      });
    });
  }

  static setCloak(on: boolean, title?: string, icon?: string) {
    const win = window.top || window;
    const doc = win.document;

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

      let link = doc.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) link.href = '/favicon.ico';
    }
  }

  static initToggles() {
    document.querySelectorAll('.toggle-switch').forEach(toggle => {
      toggle.addEventListener('click', async () => {
        toggle.classList.toggle('active');
        const key = toggle.getAttribute('data-toggle');
        const on = toggle.classList.contains('active');

        if (key) {
          if (on) {
            await SettingsAPI.enable(key);
          } else {
            await SettingsAPI.disable(key);
          }

          if (key === 'adBlock') {
            if (
              navigator.serviceWorker &&
              (navigator.serviceWorker.controller || navigator.serviceWorker.ready)
            ) {
              const msg = { type: 'ADBLOCK', data: { enabled: on } };
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage(msg);
              } else if (navigator.serviceWorker.ready) {
                navigator.serviceWorker.ready.then(reg => {
                  reg.active?.postMessage(msg);
                });
              }
            }
          }

          switch (key) {
            case 'cloak': {
              const titleIn = document.querySelector(
                '[data-input="cloakTitle"]',
              ) as HTMLInputElement;
              const iconIn = document.querySelector(
                '[data-input="cloakFavicon"]',
              ) as HTMLInputElement;
              if (titleIn) titleIn.disabled = !on;
              if (iconIn) iconIn.disabled = !on;
              this.setCloak(on, titleIn?.value, iconIn?.value);
              if (on) {
                const tabSwitchToggle = document.querySelector('[data-toggle="tabSwitchCloak"]');
                if (tabSwitchToggle?.classList.contains('active')) {
                  tabSwitchToggle.classList.remove('active');
                  await SettingsAPI.disable('tabSwitchCloak');
                  this.initAutoCloak(false);
                }
              }
              break;
            }
            case 'tabSwitchCloak': {
              if (on) {
                const cloakToggle = document.querySelector('[data-toggle="cloak"]');
                if (cloakToggle?.classList.contains('active')) {
                  cloakToggle.classList.remove('active');
                  await SettingsAPI.disable('cloak');
                  const titleIn = document.querySelector(
                    '[data-input="cloakTitle"]',
                  ) as HTMLInputElement;
                  const iconIn = document.querySelector(
                    '[data-input="cloakFavicon"]',
                  ) as HTMLInputElement;
                  if (titleIn) titleIn.disabled = true;
                  if (iconIn) iconIn.disabled = true;
                  this.setCloak(false);
                }
              }
              this.initAutoCloak(on);
              break;
            }
            case 'beforeUnload': {
              this.initExitPrompt(on);
              break;
            }
            case 'autoCloak': {
              this.initAutoCloak(on);
              break;
            }
            default:
              break;
          }
          this.notify();
        }
      });
    });
  }

  static initInputs() {
    document.querySelectorAll('[data-input]').forEach(input => {
      input.addEventListener('blur', async e => {
        const el = e.target as HTMLInputElement;
        const key = el.getAttribute('data-input');

        if (key && el.value) {
          await ConfigAPI.set(key, el.value);
          this.notify();

          if (key === 'cloakTitle' || key === 'cloakFavicon') {
            const toggle = document.querySelector('[data-toggle="cloak"]');
            const on = toggle?.classList.contains('active');
            if (on) {
              const titleIn = document.querySelector(
                '[data-input="cloakTitle"]',
              ) as HTMLInputElement;
              const iconIn = document.querySelector(
                '[data-input="cloakFavicon"]',
              ) as HTMLInputElement;
              this.setCloak(true, titleIn?.value, iconIn?.value);
            }
          }
        }
      });

      input.addEventListener('keydown', async e => {
        if ((e as KeyboardEvent).key === 'Enter') {
          const el = e.target as HTMLInputElement;
          const key = el.getAttribute('data-input');

          if (key && el.value) {
            await ConfigAPI.set(key, el.value);
            this.notify();
            el.blur();

            if (key === 'cloakTitle' || key === 'cloakFavicon') {
              const toggle = document.querySelector('[data-toggle="cloak"]');
              const on = toggle?.classList.contains('active');
              if (on) {
                const titleIn = document.querySelector(
                  '[data-input="cloakTitle"]',
                ) as HTMLInputElement;
                const iconIn = document.querySelector(
                  '[data-input="cloakFavicon"]',
                ) as HTMLInputElement;
                this.setCloak(true, titleIn?.value, iconIn?.value);
              }
            }
          }
        }
      });
    });
  }

  static initDropdowns() {
    const dropdowns = document.querySelectorAll('[data-dropdown]');

    dropdowns.forEach(dd => {
      const btn = dd.querySelector('.dropdown-selected');
      const opts = dd.querySelectorAll('.dropdown-option');

      btn?.addEventListener('click', e => {
        e.stopPropagation();
        dd.classList.toggle('open');
        dropdowns.forEach(d => {
          if (d !== dd) d.classList.remove('open');
        });
      });

      opts.forEach(opt => {
        opt.addEventListener('click', async () => {
          const val = opt.getAttribute('data-value');
          const txt = opt.textContent?.trim();
          const key = dd.getAttribute('data-dropdown');

          const display = dd.querySelector('[data-dropdown-value]');
          if (display) display.textContent = txt || '';

          opts.forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');

          if (key && val) {
            await ConfigAPI.set(key, val);
            this.notify();
          }

          dd.classList.remove('open');
        });
      });
    });

    document.addEventListener('click', () => {
      dropdowns.forEach(d => d.classList.remove('open'));
    });
  }

  static initEngines() {
    document.querySelectorAll('[data-engine]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.getAttribute('data-engine');
        if (url) {
          await ConfigAPI.set('engine', url);
          const input = document.querySelector('[data-input="engine"]') as HTMLInputElement;
          if (input) input.value = url;

          document.querySelectorAll('[data-engine]').forEach(b => {
            b.classList.remove('bg-[#6366f1]/15', 'border-[#6366f1]/50');
            const check = b.querySelector('.engine-check');
            if (check) check.classList.add('hidden');
            const icon = b.querySelector('.engine-icon');
            const txt = b.querySelector('.engine-text');
            if (icon) icon.classList.remove('text-[#6366f1]');
            if (txt) txt.classList.remove('text-[#6366f1]', 'font-semibold');
          });

          btn.classList.add('bg-[#6366f1]/15', 'border-[#6366f1]/50');
          const check = btn.querySelector('.engine-check');
          if (check) check.classList.remove('hidden');
          const icon = btn.querySelector('.engine-icon');
          const txt = btn.querySelector('.engine-text');
          if (icon) icon.classList.add('text-[#6366f1]');
          if (txt) txt.classList.add('text-[#6366f1]', 'font-semibold');

          this.notify();
        }
      });
    });
  }

  static initPresets() {
    document.querySelectorAll('[data-cloak-preset]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const title = btn.getAttribute('data-preset-title');
        const icon = btn.getAttribute('data-preset-favicon');

        if (title && icon) {
          const titleIn = document.querySelector('[data-input="cloakTitle"]') as HTMLInputElement;
          const iconIn = document.querySelector('[data-input="cloakFavicon"]') as HTMLInputElement;

          if (titleIn) titleIn.value = title;
          if (iconIn) iconIn.value = icon;

          await ConfigAPI.set('cloakTitle', title);
          await ConfigAPI.set('cloakFavicon', icon);

          const toggle = document.querySelector('[data-toggle="cloak"]');
          if (toggle?.classList.contains('active')) {
            this.setCloak(true, title, icon);
          }

          this.notify();
        }
      });
    });
  }

  static initAutoCloak(on: boolean) {
    const doc = (window.top || window).document;
    doc.removeEventListener('visibilitychange', this.handleAutoCloak);

    if (on) {
      doc.addEventListener('visibilitychange', this.handleAutoCloak);
    }
  }

  static handleAutoCloak = async () => {
    const manual = (await ConfigAPI.get('cloak')) as string;
    if (manual === 'on') return;

    const title = (await ConfigAPI.get('cloakTitle')) as string;
    const icon = (await ConfigAPI.get('cloakFavicon')) as string;
    const doc = (window.top || window).document;

    if (doc.hidden) {
      SettingsManager.setCloak(true, title, icon);
    } else {
      SettingsManager.setCloak(false);
    }
  };

  static initPanicKey() {
    const input = document.querySelector('[data-input="panicKey"]') as HTMLInputElement;
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

      const display = [];
      if (e.ctrlKey) display.push('Ctrl');
      if (e.altKey) display.push('Alt');
      if (e.shiftKey) display.push('Shift');
      if (e.metaKey) display.push('Meta');
      display.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);

      input.value = display.join('+');
      await ConfigAPI.set('panicKey', combo);

      const win = window.top || window;
      win.dispatchEvent(new CustomEvent('panicKeyChanged', { detail: combo }));

      this.notify();
      this.setPanicKey(combo);
    });

    input.addEventListener('blur', () => {
      recording = false;
      input.classList.remove('border-[#6366f1]/50', 'ring-2', 'ring-[#6366f1]/20');
      if (input.value === 'Press keys...') {
        ConfigAPI.get('panicKey').then(saved => {
          const key = saved as string;
          if (key) {
            const parts = key.split('+');
            const display = parts.map(p => {
              if (p === 'ctrl') return 'Ctrl';
              if (p === 'alt') return 'Alt';
              if (p === 'shift') return 'Shift';
              if (p === 'meta') return 'Meta';
              return p.length === 1 ? p.toUpperCase() : p;
            });
            input.value = display.join('+');
          } else {
            input.value = '';
          }
        });
      }
    });
  }

  static setPanicKey(combo: string) {
    const doc = (window.top || window).document;
    doc.removeEventListener('keydown', this.panicKeyHandler);

    this.panicKeyHandler = async (e: KeyboardEvent) => {
      const parts = [];
      if (e.ctrlKey) parts.push('ctrl');
      if (e.altKey) parts.push('alt');
      if (e.shiftKey) parts.push('shift');
      if (e.metaKey) parts.push('meta');

      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        parts.push(e.key.toLowerCase());
      }

      const pressed = parts.join('+');

      if (pressed === combo) {
        e.preventDefault();
        const url = (await ConfigAPI.get('panicLoc')) as string;
        if (url) {
          (window.top || window).location.href = url;
        }
      }
    };

    doc.addEventListener('keydown', this.panicKeyHandler);
  }

  static handleExit = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    (e as any).returnValue = '';
    return '';
  };

  static initExitPrompt(on: boolean) {
    const win = window.top || window;
    win.removeEventListener('beforeunload', this.handleExit);

    if (on) {
      win.addEventListener('beforeunload', this.handleExit);
    }
  }

  static async apply(cfg: SettingsConfig) {
    const cloakToggle = document.querySelector('[data-toggle="cloak"]') as HTMLElement;
    const titleIn = document.querySelector('[data-input="cloakTitle"]') as HTMLInputElement;
    const iconIn = document.querySelector('[data-input="cloakFavicon"]') as HTMLInputElement;

    if (cfg.cloak === 'on') {
      cloakToggle?.classList.add('active');
      if (titleIn) titleIn.disabled = false;
      if (iconIn) iconIn.disabled = false;
    } else {
      if (titleIn) titleIn.disabled = true;
      if (iconIn) iconIn.disabled = true;
    }

    const tabSwitchToggle = document.querySelector('[data-toggle="tabSwitchCloak"]') as HTMLElement;
    if (cfg.tabSwitchCloak === 'on') tabSwitchToggle?.classList.add('active');

    const autoCloakToggle = document.querySelector('[data-toggle="autoCloak"]') as HTMLElement;
    if (cfg.autoCloak === 'on') {
      autoCloakToggle?.classList.add('active');
      if (document.referrer === '') {
        const title = cfg.cloakTitle || 'Google';
        const favicon = cfg.cloakFavicon || 'https://www.google.com/favicon.ico';
        this.setCloak(true, title, favicon);
      }
    }

    const exitToggle = document.querySelector('[data-toggle="beforeUnload"]') as HTMLElement;
    if (cfg.beforeUnload === 'on') exitToggle?.classList.add('active');

    const backendDD = document.querySelector('[data-dropdown="backend"]');
    if (cfg.backend) {
      const opt = backendDD?.querySelector(`[data-value="${cfg.backend}"]`);
      const display = backendDD?.querySelector('[data-dropdown-value]');
      if (display && opt) {
        display.textContent = opt.textContent?.trim() || '';
        opt.classList.add('selected');
      }
    }

    if (titleIn && cfg.cloakTitle) titleIn.value = cfg.cloakTitle;
    if (iconIn && cfg.cloakFavicon) iconIn.value = cfg.cloakFavicon;

    const engineIn = document.querySelector('[data-input="engine"]') as HTMLInputElement;
    if (engineIn && cfg.engine) engineIn.value = cfg.engine;

    const wispIn = document.querySelector('[data-input="wispUrl"]') as HTMLInputElement;

    if (wispIn && cfg.wispUrl) {
      wispIn.value = cfg.wispUrl;
      wispIn.placeholder = cfg.wispUrl;
    }

    const panicUrlIn = document.querySelector('[data-input="panicLoc"]') as HTMLInputElement;
    if (panicUrlIn && cfg.panicLoc) panicUrlIn.value = cfg.panicLoc;

    const panicKeyIn = document.querySelector('[data-input="panicKey"]') as HTMLInputElement;
    if (panicKeyIn && cfg.panicKey) {
      const parts = cfg.panicKey.split('+');
      const display = parts.map((p: string) => {
        if (p === 'ctrl') return 'Ctrl';
        if (p === 'alt') return 'Alt';
        if (p === 'shift') return 'Shift';
        if (p === 'meta') return 'Meta';
        return p.length === 1 ? p.toUpperCase() : p;
      });
      panicKeyIn.value = display.join('+');
      this.setPanicKey(cfg.panicKey);
    }

    if (cfg.engine) {
      document.querySelectorAll('[data-engine]').forEach(btn => {
        const url = btn.getAttribute('data-engine');
        if (url === cfg.engine) {
          btn.classList.add('bg-[#6366f1]/15', 'border-[#6366f1]/50');
          const check = btn.querySelector('.engine-check');
          if (check) check.classList.remove('hidden');
          const icon = btn.querySelector('.engine-icon');
          const txt = btn.querySelector('.engine-text');
          if (icon) icon.classList.add('text-[#6366f1]');
          if (txt) txt.classList.add('text-[#6366f1]', 'font-semibold');
        }
      });
    }

    if (cfg.cloak === 'on') {
      this.setCloak(true, cfg.cloakTitle, cfg.cloakFavicon);
    } else {
      this.setCloak(false);
    }

    this.initAutoCloak(cfg.autoCloak === 'on');
    this.initExitPrompt(cfg.beforeUnload === 'on');
  }

  static async init() {
    const cfg = await this.load();
    await this.apply(cfg);

    if (
      navigator.serviceWorker &&
      (navigator.serviceWorker.controller || navigator.serviceWorker.ready)
    ) {
      const msg = { type: 'ADBLOCK', data: { enabled: cfg.adBlock === 'on' } };
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(msg);
      } else if (navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          reg.active?.postMessage(msg);
        });
      }
    }

    this.initNav();
    this.initScrollSpy();
    this.initSearch();
    this.initToggles();
    this.initInputs();
    this.initDropdowns();
    this.initEngines();
    this.initPresets();
    this.initProxyBackend();
    this.initPanicKey();

    const resetBtn = document.querySelector('[data-reset="reset"]');
    resetBtn?.addEventListener('click', () => this.reset());
  }
}
