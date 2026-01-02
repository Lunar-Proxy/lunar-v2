import { createIcons, icons } from 'lucide';

createIcons({ icons });
['astro:page-load', 'astro:after-swap'].forEach(evt =>
  document.addEventListener(evt, () => createIcons({ icons }))
);

const inputEl = document.getElementById('urlbar');
if (!(inputEl instanceof HTMLInputElement)) {
  throw new Error('No urlbar found');
}
const input = inputEl; // 🔒 non-null forever after this line

const quickLinks: Record<string, string> = {
  'lunar://settings': 'Settings',
  'lunar://new': 'New Page',
  'lunar://games': 'Games',
  'lunar://apps': 'Apps',
};

const isQuickLink = (s: string): boolean => s.startsWith('lunar://');

const matchQuickLinks = (s: string): [string, string][] => {
  const q = s.toLowerCase();
  return Object.entries(quickLinks).filter(([k]) =>
    k.toLowerCase().includes(q)
  );
};

async function fetchSuggestions(query: string): Promise<string[]> {
  if (!query) return [];
  try {
    const res = await fetch(`/api/query?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (
      typeof data === 'object' &&
      data !== null &&
      Array.isArray((data as any).suggestions)
    ) {
      return (data as any).suggestions;
    }
    return [];
  } catch {
    return [];
  }
}

function evalMath(str: string): string | null {
  const v = str.trim();
  const isMath =
    /^[0-9+\-*/().%^√\s]+$/.test(v) &&
    !/^[0-9.]+$/.test(v) &&
    /[+\-*/%^√()]/.test(v);

  if (!isMath) return null;

  try {
    const expr = v.replace(/√/g, 'Math.sqrt').replace(/\^/g, '**');
    const result = Function('"use strict";return(' + expr + ')')();
    return typeof result === 'number' && isFinite(result)
      ? String(result)
      : null;
  } catch {
    return null;
  }
}

let dropdown: HTMLDivElement | null = null;
let debounceTimer: number | null = null;

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
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
  );
}

function render(
  suggestions: string[],
  quick: [string, string][],
  math: string | null,
  query: string
): void {
  hideDropdown();
  if (!input.value.trim()) return;
  if (!suggestions.length && !quick.length && !math) return;

  const d = getDropdown();
  const html: string[] = [];

  if (math) {
    html.push(`
      <div class="flex items-center gap-2 px-6 py-3 text-[var(--text-header)] font-semibold cursor-pointer hover:bg-[#2a293f]/60 rounded-md" data-value="${math}">
        <i data-lucide="calculator" class="h-5 w-5"></i><span>${math}</span>
      </div>
    `);
  }

  if (suggestions.length) {
    html.push(`
      <div class="px-5 py-2 text-xs uppercase tracking-wider text-[var(--text-secondary)]">
        Results for <span class="font-bold text-white">${query}</span>
      </div>
    `);
    for (const s of suggestions.slice(0, 7)) {
      html.push(`
        <div class="flex items-center gap-3 px-6 py-2 text-[var(--text-header)] cursor-pointer hover:bg-[#2a293f]/60 rounded-md transition" data-value="${s}">
          <i data-lucide="search" class="h-4 w-4 text-[var(--text-secondary)]"></i><span>${s}</span>
        </div>
      `);
    }
  }

  if (quick.length) {
    html.push(`
      <div class="px-5 py-2 text-xs uppercase tracking-wider text-[var(--text-secondary)] border-t border-[var(--border)]">
        Lunar Links
      </div>
    `);
    for (const [key, label] of quick) {
      html.push(`
        <div class="flex items-center justify-between px-6 py-2 text-[var(--text-header)] cursor-pointer hover:bg-[#2a293f]/60 rounded-md transition" data-value="${key}">
          <div class="flex items-center gap-2">
            <i data-lucide="globe" class="h-5 w-5 text-purple-400"></i><span>${key}</span>
          </div>
          <span class="text-xs text-[var(--text-secondary)]">${label}</span>
        </div>
      `);
    }
  }

  d.innerHTML = html.join('');
  d.querySelectorAll<HTMLElement>('[data-value]').forEach(el =>
    el.addEventListener('click', () =>
      selectItem(el.dataset.value as string)
    )
  );

  createIcons({ icons });
  showDropdown();
}

async function update(): Promise<void> {
  const query = input.value.trim();
  if (!query) {
    hideDropdown();
    return;
  }

  const [suggestions, math] = await Promise.all([
    fetchSuggestions(query),
    Promise.resolve(evalMath(query)),
  ]);

  if (input.value.trim() !== query) return;

  const quick = isQuickLink(query) ? matchQuickLinks(query) : [];
  render(suggestions, quick, math, query);
}

function debounceUpdate(): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    if (input.value.trim()) update();
    else hideDropdown();
  }, 80);
}

input.addEventListener('input', debounceUpdate);
input.addEventListener('focus', () =>
  input.value.trim() ? update() : hideDropdown()
);
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
