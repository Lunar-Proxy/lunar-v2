import { createIcons, icons } from 'lucide';

createIcons({ icons });

['astro:page-load', 'astro:after-swap'].forEach(evt =>
  document.addEventListener(evt, () => createIcons({ icons })),
);

const inputEl = document.getElementById('urlbar');
if (!(inputEl instanceof HTMLInputElement)) {
  throw new Error('No urlbar found');
}
const input = inputEl;

const quickLinks: Record<string, string> = {
  'lunar://settings': 'Settings',
  'lunar://new': 'New Page',
  'lunar://games': 'Games',
  'lunar://apps': 'Apps',
};

function isQuickLink(s: string): boolean {
  return s.startsWith('lunar://');
}

function matchQuickLinks(s: string): [string, string][] {
  const q = s.toLowerCase();
  return Object.entries(quickLinks).filter(([k]) => k.toLowerCase().includes(q));
}

async function fetchSuggestions(query: string): Promise<string[]> {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(`/api/query?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (typeof data === 'object' && data !== null && Array.isArray((data as any).suggestions)) {
      return (data as any).suggestions;
    }
    return [];
  } catch {
    return [];
  }
}

function evalMath(str: string): string | null {
  const v = str.trim();
  const isMath = /^[0-9+\-*/().%^√\s]+$/.test(v) && !/^[0-9.]+$/.test(v) && /[+\-*/%^√()]/.test(v);
  if (!isMath) return null;
  try {
    const expr = v.replace(/√/g, 'Math.sqrt').replace(/\^/g, '**');
    const result = Function('"use strict";return(' + expr + ')')();
    return typeof result === 'number' && isFinite(result) ? String(result) : null;
  } catch {
    return null;
  }
}

let dropdown: HTMLDivElement | null = null;
let debounceTimer: number | null = null;
let lastQuery = '';

function getDropdown(): HTMLDivElement {
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'suggestions';
    dropdown.className =
      'absolute top-full z-50 mt-0 mb-28 w-full rounded-xl border border-[#3a3758] bg-[#1f1f30]/90 shadow-2xl backdrop-blur-xl transition-all duration-200 overflow-y-auto';
    input.parentElement?.appendChild(dropdown);
  }
  return dropdown;
}

function hideDropdown(): void {
  dropdown?.remove();
  dropdown = null;
}

function showDropdown(): void {
  if (!dropdown || !input.value.trim()) {
    hideDropdown();
    return;
  }
  const rect = input.getBoundingClientRect();
  dropdown.style.maxHeight = `${window.innerHeight - rect.bottom - 12}px`;
}

function selectItem(value: string): void {
  input.value = value;
  hideDropdown();
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

function render(
  suggestions: string[],
  quick: [string, string][],
  math: string | null,
  query: string,
): void {
  hideDropdown();
  if (!input.value.trim()) return;
  if (!suggestions.length && !quick.length && !math) return;

  const d = getDropdown();
  const html: string[] = [];

  if (math) {
    html.push(
      `<div class="cursor-pointer border-b border-[#3a3758] p-3 hover:bg-[#2a2a40]" data-value="${math}"><div class="font-mono text-lg text-purple-300">${math}</div></div>`,
    );
  }

  if (suggestions.length) {
    html.push(
      `<div class="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Results for ${query}</div>`,
    );
    for (const s of suggestions.slice(0, 7)) {
      html.push(
        `<div class="cursor-pointer border-b border-[#3a3758] p-3 hover:bg-[#2a2a40]" data-value="${s}"><div class="text-sm text-gray-200">${s}</div></div>`,
      );
    }
  }

  if (quick.length) {
    html.push(
      `<div class="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Lunar Links</div>`,
    );
    for (const [key, label] of quick) {
      html.push(
        `<div class="cursor-pointer border-b border-[#3a3758] p-3 hover:bg-[#2a2a40]" data-value="${key}"><div class="text-sm font-medium text-purple-300">${key}</div><div class="text-xs text-gray-400">${label}</div></div>`,
      );
    }
  }

  d.innerHTML = html.join('');
  d.querySelectorAll<HTMLElement>('[data-value]').forEach(el =>
    el.addEventListener('click', () => selectItem(el.dataset.value as string)),
  );
  createIcons({ icons });
  showDropdown();
}

async function update(): Promise<void> {
  const query = input.value.trim();

  if (!query) {
    hideDropdown();
    lastQuery = '';
    return;
  }

  if (query === lastQuery) return;
  lastQuery = query;

  const quick = isQuickLink(query) ? matchQuickLinks(query) : [];
  const math = evalMath(query);

  if (query.length < 2) {
    render([], quick, math, query);
    return;
  }

  const suggestions = await fetchSuggestions(query);
  if (input.value.trim() !== query) return;
  render(suggestions, quick, math, query);
}

function debounceUpdate(): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    if (input.value.trim()) update();
    else hideDropdown();
  }, 150);
}

input.addEventListener('input', debounceUpdate);
input.addEventListener('focus', () => (input.value.trim() ? update() : hideDropdown()));
input.addEventListener('blur', () => setTimeout(hideDropdown, 120));
input.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    hideDropdown();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') hideDropdown();
});

window.addEventListener('resize', () => {
  if (dropdown) showDropdown();
});

document.addEventListener('mousedown', e => {
  const t = e.target as HTMLElement;
  if (!t.closest('#urlbar') && !t.closest('#suggestions')) {
    hideDropdown();
  }
});
