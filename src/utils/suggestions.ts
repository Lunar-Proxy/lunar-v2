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

let debounceTimer: number | null = null;
let isMenuOpen = false;
let currentQuery = '';

function isQuickLink(str: string): boolean {
  return str.startsWith('lunar://');
}

function matchQuickLinks(str: string): [string, string][] {
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
  const v = str.trim().replace(/x/gi, '*');
  return /^[0-9+\-*/().%^√\s]+$/.test(v) && !/^[0-9.]+$/.test(v) && /[+\-*/%^√()]/.test(v);
}

function calcExpr(str: string): string | null {
  try {
    const expr = str
      .replace(/x/gi, '*')
      .replace(/√(\d+)/g, 'Math.sqrt($1)')
      .replace(/√/g, 'Math.sqrt')
      .replace(/\^/g, '**')
      .replace(/(\d+)%/g, '($1/100)');
    const result = Function('"use strict";return(' + expr + ')')();
    return typeof result === 'number' && isFinite(result) ? String(result) : null;
  } catch {
    return null;
  }
}

function makeDropdown(): HTMLDivElement {
  hideMenu();
  const dropdown = document.createElement('div');
  dropdown.id = 'suggestions';
  dropdown.className = 'absolute top-full z-50 mt-0 w-full rounded-b-xl border-x border-b border-[#3a3758] bg-[#1f1f30]/95 shadow-2xl backdrop-blur-xl transition-all duration-200 overflow-y-auto opacity-0 hidden';
  input?.parentElement?.appendChild(dropdown);
  return dropdown;
}

function showMenu(menu: HTMLDivElement): void {
  if (!input || !input.value.trim()) {
    hideMenu();
    return;
  }
  menu.classList.remove('opacity-0', 'hidden');
  const rect = input.getBoundingClientRect();
  const maxHeight = window.innerHeight - rect.bottom - 16;
  menu.style.maxHeight = `${Math.max(maxHeight, 100)}px`;
}

function hideMenu(): void {
  document.getElementById('suggestions')?.remove();
  isMenuOpen = false;
}

function setInputValue(val: string): void {
  if (!input) return;
  input.value = val;
  hideMenu();
  const event = new KeyboardEvent('keydown', { 
    key: 'Enter', 
    code: 'Enter',
    keyCode: 13,
    bubbles: true,
    cancelable: true
  });
  input.dispatchEvent(event);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMenu(suggestions: string[], quick: [string, string][], math: string | null, query: string): void {
  hideMenu();
  if (!input || !input.value.trim()) return;
  const list = suggestions.slice(0, 7);
  const showQuick = isQuickLink(query);
  if (!list.length && !quick.length && !math) return;
  
  const dropdown = makeDropdown();
  const html: string[] = [];
  
  if (math) {
    html.push(`<div class="flex items-center space-x-3 px-4 py-3 text-(--text-header) cursor-pointer hover:bg-[#2a293f] transition-colors" data-value="${escapeHtml(math)}"><i data-lucide="calculator" class="h-5 w-5 text-green-400"></i><span>${escapeHtml(math)}</span></div>`);
  }
  
  if (list.length) {
    html.push(`<div class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">Suggestions for <span class="text-white">"${escapeHtml(query)}"</span></div>`);
    list.forEach(suggestion => {
      html.push(`<div class="flex items-center space-x-3 px-4 py-3 text-(--text-header) cursor-pointer hover:bg-[#2a293f] transition-colors" data-value="${escapeHtml(suggestion)}"><i data-lucide="search" class="h-4 w-4 text-(--text-secondary)"></i><span>${escapeHtml(suggestion)}</span></div>`);
    });
  }
  
  if (showQuick && quick.length) {
    html.push(`<div class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary) border-t border-[#3a3758]">Lunar Links</div>`);
    quick.forEach(([link, label]) => {
      html.push(`<div class="flex items-center justify-between px-4 py-3 text-(--text-header) cursor-pointer hover:bg-[#2a293f] transition-colors" data-value="${escapeHtml(link)}"><div class="flex items-center space-x-3"><i data-lucide="globe" class="h-5 w-5 text-purple-400"></i><span>${escapeHtml(link)}</span></div><span class="text-xs text-(--text-secondary)">${escapeHtml(label)}</span></div>`);
    });
  }
  
  dropdown.innerHTML = html.join('');
  dropdown.querySelectorAll<HTMLElement>('[data-value]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const value = el.dataset.value;
      if (value) setInputValue(value);
    });
  });
  createIcons({ icons });
  showMenu(dropdown);
  isMenuOpen = true;
}

async function updateMenu(): Promise<void> {
  if (!input) return;
  const value = input.value.trim();
  if (!value) {
    hideMenu();
    return;
  }
  currentQuery = value;
  const [suggestions, mathResult] = await Promise.all([
    getSuggestions(value),
    isMathExpr(value) ? calcExpr(value) : Promise.resolve(null),
  ]);
  if (input.value.trim() !== currentQuery) return;
  const quickMatches = isQuickLink(value) ? matchQuickLinks(value) : [];
  renderMenu(suggestions, quickMatches, mathResult, value);
}

function debounceUpdate(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    if (!input || !input.value.trim()) {
      hideMenu();
      return;
    }
    updateMenu();
  }, 150);
}

function closeMenuDelayed(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  setTimeout(() => hideMenu(), 150);
}

if (input) {
  input.addEventListener('input', debounceUpdate);
  input.addEventListener('focus', () => {
    if (input.value.trim()) updateMenu();
  });
  input.addEventListener('blur', closeMenuDelayed);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      hideMenu();
    } else if (e.key === 'Enter') {
      hideMenu();
    }
  });
  window.addEventListener('resize', () => {
    const dropdown = document.getElementById('suggestions') as HTMLDivElement | null;
    if (dropdown && isMenuOpen && input && input.value.trim()) {
      showMenu(dropdown);
    } else if (dropdown) {
      hideMenu();
    }
  });
  document.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('#urlbar') && !target.closest('#suggestions')) hideMenu();
  });
  document.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('#suggestions')) e.preventDefault();
  }, true);
}