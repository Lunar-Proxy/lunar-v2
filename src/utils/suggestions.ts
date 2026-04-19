import { shadow, ready, replaceIcons } from './shadow';

let urlbar: HTMLInputElement | null = null;

const quickLinks: Record<string, string> = {
  'lunar://settings': 'Settings',
  'lunar://new': 'New Page',
  'lunar://games': 'Games',
};

let debounceTimer: number | null = null;
let isOpen = false;
let lastQuery = '';
let activeIndex = -1;
let ignoreBlur = false;
let requestId = 0;

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

function getDropdown(): HTMLDivElement | null {
  return shadow.querySelector('#suggestions') as HTMLDivElement | null;
}

function closeSuggestions(): void {
  isOpen = false;
  activeIndex = -1;
  requestId++;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  const dropdown = getDropdown();
  if (!dropdown) return;

  dropdown.style.opacity = '0';
  dropdown.style.pointerEvents = 'none';

  setTimeout(() => {
    if (!isOpen) dropdown.remove();
  }, 150);
}

function showDropdown(dropdown: HTMLDivElement): void {
  if (!urlbar?.value.trim()) {
    closeSuggestions();
    return;
  }

  dropdown.style.opacity = '1';
  dropdown.style.pointerEvents = 'auto';

  const rect = urlbar.getBoundingClientRect();
  const availableHeight = window.innerHeight - rect.bottom - 16;
  const clampedHeight = Math.min(Math.max(availableHeight, 140), 340);
  dropdown.style.maxHeight = `${clampedHeight}px`;

  isOpen = true;
}

function setActiveItem(dropdown: HTMLDivElement, index: number): void {
  const items = dropdown.querySelectorAll<HTMLElement>('[data-value]');

  items.forEach((el, i) => {
    const active = i === index;
    el.classList.toggle('bg-background-disabled/60', active);
    if (active) el.scrollIntoView({ block: 'nearest' });
  });
}

function selectSuggestion(value: string): void {
  if (!urlbar) return;

  urlbar.value = value;
  closeSuggestions();
  urlbar.blur();

  urlbar.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      bubbles: true,
      cancelable: true,
    })
  );
}

function buildRow(
  icon: string,
  iconClass: string,
  label: string,
  value: string,
  trailing?: string
): string {
  const base = `<div class="text-text-muted hover:text-text-header flex items-center ${trailing ? 'justify-between' : 'space-x-3'} cursor-pointer px-3 py-2 text-sm transition-colors hover:bg-background-overlay/70" data-value="${escapeHtml(value)}">`;
  const iconEl = `<i data-lucide="${icon}" class="${iconClass}"></i>`;
  const labelEl = `<span>${escapeHtml(label)}</span>`;

  if (trailing) {
    return (
      base +
      `<div class="flex items-center space-x-3">${iconEl}${labelEl}</div>` +
      `<span class="text-text-secondary/80 text-xs">${escapeHtml(trailing)}</span></div>`
    );
  }

  return base + iconEl + labelEl + '</div>';
}

function renderSuggestions(
  suggestions: string[],
  quickMatches: [string, string][],
  mathResult: string | null,
  query: string
): void {
  getDropdown()?.remove();
  activeIndex = -1;

  if (!urlbar?.value.trim()) return;

  const topSuggestions = suggestions.slice(0, 7);
  const hasQuickLinks = isLunarUrl(query);

  if (!topSuggestions.length && !quickMatches.length && !mathResult) return;

  const dropdown = document.createElement('div');
  dropdown.id = 'suggestions';
  dropdown.className =
    'border-border-default/90 absolute top-full z-50 mt-0 w-full overflow-y-auto rounded-b-xl border-x border-b bg-[color:var(--background-overlay)]/95 shadow-2xl backdrop-blur-xl transition-opacity duration-150';
  dropdown.style.opacity = '0';
  dropdown.style.pointerEvents = 'none';

  urlbar.parentElement?.appendChild(dropdown);

  const rows: string[] = [];

  if (mathResult) {
    rows.push(buildRow('calculator', 'h-4 w-4 text-[color:var(--accent-light)]', mathResult, mathResult));
  }

  if (topSuggestions.length) {
    rows.push(
      `<div class="text-text-secondary/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider">` +
        `Suggestions for <span class="text-text-header">"${escapeHtml(query)}"</span></div>`
    );

    for (const s of topSuggestions) {
      rows.push(buildRow('search', 'text-text-secondary h-3.5 w-3.5', s, s));
    }
  }

  if (hasQuickLinks && quickMatches.length) {
    rows.push(
      `<div class="text-text-secondary/80 border-border-default/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider border-t">Lunar Links</div>`
    );

    for (const [link, description] of quickMatches) {
      rows.push(buildRow('globe', 'h-4 w-4 text-[color:var(--accent)]', link, link, description));
    }
  }

  dropdown.innerHTML = rows.join('');

  dropdown.querySelectorAll<HTMLElement>('[data-value]').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      ignoreBlur = true;

      const value = el.dataset.value;
      if (value) selectSuggestion(value);
    });
  });

  replaceIcons(dropdown);
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
  const currentRequest = ++requestId;
  const internalQuery = isLunarUrl(query);

  const [suggestions, mathResult] = await Promise.all([
    internalQuery ? Promise.resolve([]) : fetchSuggestions(query),
    Promise.resolve(isMathExpression(query) ? evaluateMath(query) : null),
  ]);

  if (currentRequest !== requestId) return;
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

ready.then(() => {
  urlbar = shadow.querySelector('#urlbar') as HTMLInputElement | null;

  if (urlbar) {
    urlbar.addEventListener('input', scheduleUpdate);

    urlbar.addEventListener('focus', () => {
      if (urlbar!.value.trim()) updateSuggestions();
    });

    urlbar.addEventListener('blur', () => {
      if (ignoreBlur) {
        ignoreBlur = false;
        return;
      }
      closeSuggestions();
    });

    urlbar.addEventListener('keydown', e => {
      const dropdown = getDropdown();

      if (e.key === 'Escape') {
        e.preventDefault();
        closeSuggestions();
        urlbar!.blur();
        return;
      }

      if (e.key === 'Enter') {
        if (dropdown && activeIndex >= 0) {
          e.preventDefault();
          const items = dropdown.querySelectorAll<HTMLElement>('[data-value]');
          const value = items[activeIndex]?.dataset.value;
          if (value) selectSuggestion(value);
        } else {
          closeSuggestions();
        }
        return;
      }

      if (!dropdown) return;

      const items = dropdown.querySelectorAll<HTMLElement>('[data-value]');
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        setActiveItem(dropdown, activeIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        setActiveItem(dropdown, activeIndex);
      }
    });

    window.addEventListener('resize', () => {
      const dropdown = getDropdown();

      if (dropdown && isOpen && urlbar!.value.trim()) showDropdown(dropdown);
      else closeSuggestions();
    });

    shadow.addEventListener('mousedown', ((e: MouseEvent) => {
      const dropdown = getDropdown();
      if (!dropdown) return;

      if (dropdown.contains(e.target as Node) || urlbar!.contains(e.target as Node)) return;

      closeSuggestions();
      urlbar!.blur();
    }) as EventListener);
  }
});
