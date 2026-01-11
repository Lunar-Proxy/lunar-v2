import { createIcons, icons } from 'lucide';

createIcons({ icons });
['astro:page-load', 'astro:after-swap'].forEach(evt => {
  document.addEventListener(evt, () => createIcons({ icons }));
});


const input = document.getElementById('urlbar') as HTMLInputElement | null;
const quickLinks: Record<string, string> = {
  'lunar://settings': 'Settings',
  'lunar://new': 'New Page',
  'lunar://games': 'Games',
  'lunar://apps': 'Apps',
};

function isQuickLink(str: string) {
  return str.startsWith('lunar://');
}

function matchQuickLinks(str: string) {
  const q = str.toLowerCase();
  return Object.entries(quickLinks).filter(([k]) => k.toLowerCase().includes(q));
}

async function getSuggestions(query: string): Promise<string[]> {
  if (!query) return [];
  try {
    const res = await fetch(`/api/query?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.suggestions) ? data.suggestions : [];
  } catch {
    return [];
  }
}

function isMathExpr(str: string): boolean {
  const v = str.trim();
  return /^[0-9+\-*/().%^√\s]+$/.test(v) && !/^[0-9.]+$/.test(v) && /[+\-*/%^√()]/.test(v);
}

function calcExpr(str: string): string | null {
  try {
    const expr = str.replace(/√/g, 'Math.sqrt').replace(/\^/g, '**');
    const out = Function('"use strict";return(' + expr + ')')();
    return typeof out === 'number' && isFinite(out) ? out.toString() : null;
  } catch {
    return null;
  }
}

function makeDropdown(): HTMLDivElement {
  const d = document.createElement('div');
  d.id = 'suggestions';
  d.className =
    'absolute top-full z-50 mt-0 mb-28 w-full rounded-xl border border-[#3a3758] bg-[#1f1f30]/90 shadow-2xl backdrop-blur-xl transition-all duration-200 overflow-y-auto opacity-0 hidden';
  input?.parentElement?.appendChild(d);
  return d;
}

function showMenu(menu: HTMLDivElement) {
  if (!input || !input.value.trim()) {
    hideMenu();
    return;
  }
  menu.classList.remove('opacity-0', 'hidden');
  const r = input.getBoundingClientRect();
  menu.style.maxHeight = `${window.innerHeight - r.bottom - 12}px`;
}

function hideMenu() {
  document.getElementById('suggestions')?.remove();
}

function setInputValue(val: string) {
  if (!input) return;
  input.value = val;
  hideMenu();
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

function renderMenu(suggestions: string[], quick: [string, string][], math: string | null, query: string) {
  hideMenu();
  if (!input || !input.value.trim()) return;
  const max = 7;
  const list = suggestions.slice(0, max);
  const showQuick = isQuickLink(query);
  if (!list.length && !quick.length && !math) return;
  const d = makeDropdown();
  const html: string[] = [];
  if (math) {
    html.push(`
      <div class="flex items-center space-x-2 px-6 py-3 text-(--text-header) font-semibold cursor-pointer hover:bg-[#2a293f] hover:text-white rounded-md" data-value="${math}">
        <i data-lucide="calculator" class="h-5 w-5"></i><span>${math}</span>
      </div>
    `);
  }
  if (list.length) {
    html.push(
      `<div class="px-5 py-2 text-xs uppercase tracking-wider text-(--text-secondary)">Results for <span class="font-bold text-white">${query}</span></div>`,
      ...list.map(
        r => `
      <div class="flex items-center space-x-3 px-6 py-2 text-(--text-header) cursor-pointer hover:bg-[#2a293f] hover:text-white rounded-md transition" data-value="${r}">
        <i data-lucide="search" class="h-4 w-4 text-(--text-secondary)"></i><span>${r}</span>
      </div>`,
      ),
    );
  }
  if (showQuick && quick.length) {
    html.push(
      `<div class="px-5 py-2 text-xs uppercase tracking-wider text-(--text-secondary) border-t border-(--border)">Lunar Links</div>`,
      ...quick.map(
        ([k, l]) => `
        <div class="flex items-center justify-between px-6 py-2 text-(--text-header) cursor-pointer hover:bg-[#2a293f] hover:text-white rounded-md transition" data-value="${k}">
          <div class="flex items-center space-x-2">
            <i data-lucide="globe" class="h-5 w-5 text-purple-400"></i><span>${k}</span>
          </div>
          <span class="text-xs text-(--text-secondary)">${l}</span>
        </div>
      `,
      ),
    );
  }
  d.innerHTML = html.join('');
  d.querySelectorAll<HTMLElement>('[data-value]').forEach(el => {
    el.addEventListener('click', () => setInputValue(el.dataset.value || ''));
  });
  createIcons({ icons });
  showMenu(d);
}

async function updateMenu() {
  if (!input) return;
  const v = input.value.trim();
  if (!v) {
    hideMenu();
    return;
  }
  const [suggestions, math] = await Promise.all([
    getSuggestions(v),
    isMathExpr(v) ? calcExpr(v) : null,
  ]);
  if (input.value.trim() !== v) {
    hideMenu();
    return;
  }
  const quick = isQuickLink(v) ? matchQuickLinks(v) : [];
  renderMenu(suggestions, quick, math, v);
}

if (input) {
  let debounce: number | null = null;
  let menuOpen = false;

  function closeMenu() {
    if (debounce) {
      clearTimeout(debounce);
      debounce = null;
    }
    menuOpen = false;
    hideMenu();
  }

  function openMenu() {
    menuOpen = true;
  }

  input.addEventListener('input', () => {
    if (debounce) clearTimeout(debounce);
    debounce = window.setTimeout(() => {
      if (!input.value.trim()) {
        closeMenu();
        return;
      }
      updateMenu();
      openMenu();
    }, 80);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim()) {
      updateMenu();
      openMenu();
    } else closeMenu();
  });

  input.addEventListener('blur', () => {
    setTimeout(closeMenu, 120);
  });

  input.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    closeMenu();
  }
});

  window.addEventListener('resize', () => {
    const d = document.getElementById('suggestions') as HTMLDivElement | null;
    if (d && menuOpen && input && input.value.trim()) showMenu(d);
    else if (d) closeMenu();
  });

  document.addEventListener('mousedown', e => {
    const t = e.target as HTMLElement;
    if (!t.closest('#urlbar') && !t.closest('#suggestions')) closeMenu();
  });

  const origMakeDropdown = makeDropdown;
  function makeDropdownOnce(): HTMLDivElement {
    hideMenu();
    return origMakeDropdown();
  }
  // @ts-ignore
  makeDropdown = makeDropdownOnce;
}