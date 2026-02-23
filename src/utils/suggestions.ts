import { createIcons, icons } from 'lucide';

createIcons({ icons });
['astro:page-load', 'astro:after-swap'].forEach(evt => {
  document.addEventListener(evt, () => createIcons({ icons }));
});

const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;

const quickLinks: Record<string, string> = {
  'lunar://settings': 'Settings',
  'lunar://new': 'New Page',
  'lunar://games': 'Games',
};

let debounceTimer: number | null = null;
let isOpen = false;
let lastQuery = '';
let overlay: HTMLDivElement | null = null;

function isLunarUrl(str: string): boolean {
  return str.startsWith('lunar://');
}

function matchQuickLinks(str: string): [string, string][] {
  const lower = str.toLowerCase();
  return Object.entries(quickLinks).filter(([key]) => key.toLowerCase().includes(lower));
}

async function fetchSuggestions(query: string): Promise<string[]> {
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

function isMathExpression(str: string): boolean {
  const normalized = str.trim().replace(/x/gi, '*');
  return (
    /^[0-9+\-*/().%^√\s]+$/.test(normalized) &&
    !/^[0-9.]+$/.test(normalized) &&
    /[+\-*/%^√()]/.test(normalized)
  );
}

function evaluateMath(str: string): string | null {
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

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function createDropdown(): HTMLDivElement {
  closeSuggestions();
  const dropdown = document.createElement('div');
  dropdown.id = 'suggestions';
  dropdown.className =
    'absolute top-full z-50 mt-0 w-full rounded-b-xl border-x border-b border-[#3a3758] bg-[#1f1f30]/95 shadow-2xl backdrop-blur-xl transition-all duration-200 overflow-y-auto opacity-0 hidden';
  urlbar?.parentElement?.appendChild(dropdown);
  return dropdown;
}

function showDropdown(dropdown: HTMLDivElement): void {
  if (!urlbar?.value.trim()) {
    closeSuggestions();
    return;
  }
  dropdown.classList.remove('opacity-0', 'hidden');
  const rect = urlbar.getBoundingClientRect();
  const maxHeight = window.innerHeight - rect.bottom - 16;
  dropdown.style.maxHeight = `${Math.max(maxHeight, 100)}px`;
  isOpen = true;
  mountOverlay();
}

function mountOverlay(): void {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:40;background:transparent;';
  overlay.addEventListener('mousedown', e => {
    // Don't close if clicking inside the dropdown or urlbar
    const target = e.target as HTMLElement;
    if (target.closest('#suggestions') || target.closest('#urlbar')) return;
    closeSuggestions();
  });
  document.body.appendChild(overlay);
}

function removeOverlay(): void {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

function closeSuggestions(): void {
  const dropdown = document.getElementById('suggestions');
  if (dropdown) {
    dropdown.classList.add('opacity-0');
    setTimeout(() => dropdown.remove(), 200);
  }
  removeOverlay();
  isOpen = false;
}

function selectSuggestion(value: string): void {
  if (!urlbar) return;
  urlbar.value = value;
  closeSuggestions();
  urlbar.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function renderSuggestions(
  suggestions: string[],
  quickMatches: [string, string][],
  mathResult: string | null,
  query: string,
): void {
  closeSuggestions();
  if (!urlbar?.value.trim()) return;

  const topSuggestions = suggestions.slice(0, 7);
  const hasQuickLinks = isLunarUrl(query);

  if (!topSuggestions.length && !quickMatches.length && !mathResult) return;

  const dropdown = createDropdown();
  const rows: string[] = [];

  if (mathResult) {
    rows.push(
      `<div class="flex items-center space-x-3 px-4 py-3 text-(--text-header) cursor-pointer hover:bg-[#2a293f] transition-colors" data-value="${escapeHtml(mathResult)}">` +
        `<i data-lucide="calculator" class="h-5 w-5 text-green-400"></i><span>${escapeHtml(mathResult)}</span></div>`,
    );
  }

  if (topSuggestions.length) {
    rows.push(
      `<div class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">` +
        `Suggestions for <span class="text-white">"${escapeHtml(query)}"</span></div>`,
    );
    topSuggestions.forEach(suggestion => {
      rows.push(
        `<div class="flex items-center space-x-3 px-4 py-3 text-(--text-header) cursor-pointer hover:bg-[#2a293f] transition-colors" data-value="${escapeHtml(suggestion)}">` +
          `<i data-lucide="search" class="h-4 w-4 text-(--text-secondary)"></i><span>${escapeHtml(suggestion)}</span></div>`,
      );
    });
  }

  if (hasQuickLinks && quickMatches.length) {
    rows.push(
      `<div class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary) border-t border-[#3a3758]">Lunar Links</div>`,
    );
    quickMatches.forEach(([link, description]) => {
      rows.push(
        `<div class="flex items-center justify-between px-4 py-3 text-(--text-header) cursor-pointer hover:bg-[#2a293f] transition-colors" data-value="${escapeHtml(link)}">` +
          `<div class="flex items-center space-x-3"><i data-lucide="globe" class="h-5 w-5 text-purple-400"></i><span>${escapeHtml(link)}</span></div>` +
          `<span class="text-xs text-(--text-secondary)">${escapeHtml(description)}</span></div>`,
      );
    });
  }

  dropdown.innerHTML = rows.join('');
  dropdown.querySelectorAll<HTMLElement>('[data-value]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const value = el.dataset.value;
      if (value) selectSuggestion(value);
    });
  });
  createIcons({ icons });
  showDropdown(dropdown);
}

async function updateSuggestions(): Promise<void> {
  if (!urlbar) return;
  const query = urlbar.value.trim();
  if (!query) {
    closeSuggestions();
    return;
  }

  lastQuery = query;

  const [suggestions, mathResult] = await Promise.all([
    fetchSuggestions(query),
    isMathExpression(query) ? evaluateMath(query) : Promise.resolve(null),
  ]);

  if (urlbar.value.trim() !== lastQuery) return;

  const quickMatches = isLunarUrl(query) ? matchQuickLinks(query) : [];
  renderSuggestions(suggestions, quickMatches, mathResult, query);
}

function scheduleUpdate(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    if (!urlbar?.value.trim()) {
      closeSuggestions();
      return;
    }
    updateSuggestions();
  }, 150);
}

if (urlbar) {
  urlbar.addEventListener('input', scheduleUpdate);

  urlbar.addEventListener('focus', () => {
    if (urlbar.value.trim()) updateSuggestions();
  });

  urlbar.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSuggestions();
    } else if (e.key === 'Enter') closeSuggestions();
  });

  window.addEventListener('resize', () => {
    const dropdown = document.getElementById('suggestions') as HTMLDivElement | null;
    if (dropdown && isOpen && urlbar.value.trim()) showDropdown(dropdown);
    else if (dropdown) closeSuggestions();
  });
}
