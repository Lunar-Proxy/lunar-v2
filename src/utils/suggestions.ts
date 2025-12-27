import { createIcons, icons } from 'lucide';

createIcons({ icons });
['astro:page-load', 'astro:after-swap'].forEach(evt => {
  document.addEventListener(evt, () => createIcons({ icons }));
});

const urlInput = document.getElementById('urlbar') as HTMLInputElement | null;
const lunarLinks: Record<string, string> = {
  'lunar://settings': 'Settings',
  'lunar://new': 'New Page',
  'lunar://games': 'Games',
  'lunar://apps': 'Apps',
};

function isLunarLink(val: string) {
  return val.startsWith('lunar://');
}

function filterLunarLinks(val: string) {
  const q = val.toLowerCase();
  return Object.entries(lunarLinks).filter(([k]) => k.toLowerCase().includes(q));
}

async function fetchSuggestions(q: string): Promise<string[]> {
  if (!q) return [];
  try {
    const r = await fetch(`/api/query?q=${encodeURIComponent(q)}`);
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j.suggestions) ? j.suggestions : [];
  } catch {
    return [];
  }
}

function isMath(val: string): boolean {
  const v = val.trim();
  return /^[0-9+\-*/().%^√\s]+$/.test(v) && !/^[0-9.]+$/.test(v) && /[+\-*/%^√()]/.test(v);
}

function calcMath(val: string): string | null {
  try {
    const expr = val.replace(/√/g, 'Math.sqrt').replace(/\^/g, '**');
    const out = Function('"use strict";return(' + expr + ')')();
    return typeof out === 'number' && isFinite(out) ? out.toString() : null;
  } catch {
    return null;
  }
}

function createDropdown(): HTMLDivElement {
  const d = document.createElement('div');
  d.id = 'suggestions';
  d.className =
    'absolute top-full z-50 mt-0 mb-28 w-full rounded-xl border border-[#3a3758] bg-[#1f1f30]/90 shadow-2xl backdrop-blur-xl transition-all duration-200 overflow-y-auto opacity-0 hidden';
  urlInput?.parentElement?.appendChild(d);
  return d;
}

function showDropdown(drop: HTMLDivElement) {
  if (!urlInput || !urlInput.value.trim()) {
    hideDropdown();
    return;
  }
  drop.classList.remove('opacity-0', 'hidden');
  const r = urlInput.getBoundingClientRect();
  drop.style.maxHeight = `${window.innerHeight - r.bottom - 12}px`;
}

function hideDropdown() {
  document.getElementById('suggestions')?.remove();
}

function setInput(val: string) {
  if (!urlInput) return;
  urlInput.value = val;
  hideDropdown();
  urlInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

function renderDropdown(suggestions: string[], lunar: [string, string][], math: string | null, query: string) {
  hideDropdown();
  if (!urlInput || !urlInput.value.trim()) return;
  const max = 7;
  const list = suggestions.slice(0, max);
  const showLunar = isLunarLink(query);
  if (!list.length && !lunar.length && !math) return;
  const d = createDropdown();
  const html: string[] = [];
  if (math) {
    html.push(`
      <div class="flex items-center space-x-2 px-6 py-3 text-[var(--text-header)] font-semibold cursor-pointer hover:bg-[#2a293f] hover:text-white rounded-md" data-value="${math}">
        <i data-lucide="calculator" class="h-5 w-5"></i><span>${math}</span>
      </div>
    `);
  }
  if (list.length) {
    html.push(
      `<div class="px-5 py-2 text-xs uppercase tracking-wider text-[var(--text-secondary)]">Results for <span class="font-bold text-white">${query}</span></div>`,
      ...list.map(
        r => `
      <div class="flex items-center space-x-3 px-6 py-2 text-[var(--text-header)] cursor-pointer hover:bg-[#2a293f] hover:text-white rounded-md transition" data-value="${r}">
        <i data-lucide="search" class="h-4 w-4 text-[var(--text-secondary)]"></i><span>${r}</span>
      </div>`,
      ),
    );
  }
  if (showLunar && lunar.length) {
    html.push(
      `<div class="px-5 py-2 text-xs uppercase tracking-wider text-[var(--text-secondary)] border-t border-[var(--border)]">Lunar Links</div>`,
      ...lunar.map(
        ([k, l]) => `
        <div class="flex items-center justify-between px-6 py-2 text-[var(--text-header)] cursor-pointer hover:bg-[#2a293f] hover:text-white rounded-md transition" data-value="${k}">
          <div class="flex items-center space-x-2">
            <i data-lucide="globe" class="h-5 w-5 text-purple-400"></i><span>${k}</span>
          </div>
          <span class="text-xs text-[var(--text-secondary)]">${l}</span>
        </div>
      `,
      ),
    );
  }
  d.innerHTML = html.join('');
  d.querySelectorAll<HTMLElement>('[data-value]').forEach(el => {
    el.addEventListener('click', () => setInput(el.dataset.value || ''));
  });
  createIcons({ icons });
  showDropdown(d);
}

async function updateDropdown() {
  if (!urlInput) return;
  const v = urlInput.value.trim();
  if (!v) {
    hideDropdown();
    return;
  }
  const [suggestions, math] = await Promise.all([
    fetchSuggestions(v),
    isMath(v) ? calcMath(v) : null,
  ]);
  if (urlInput.value.trim() !== v) {
    hideDropdown();
    return;
  }
  const lunar = isLunarLink(v) ? filterLunarLinks(v) : [];
  renderDropdown(suggestions, lunar, math, v);
}

if (urlInput) {
  let timer: number | null = null;
  let dropVisible = false;
  function safeHideDropdown() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    dropVisible = false;
    hideDropdown();
  }
  urlInput.addEventListener('input', () => {
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!urlInput.value.trim()) {
        safeHideDropdown();
        return;
      }
      updateDropdown();
    }, 80);
  });
  urlInput.addEventListener('focus', () => {
    if (urlInput.value.trim()) updateDropdown();
    else safeHideDropdown();
  });
  urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') safeHideDropdown();
  });
  window.addEventListener('resize', () => {
    const d = document.getElementById('suggestions') as HTMLDivElement | null;
    if (d && dropVisible && urlInput && urlInput.value.trim()) showDropdown(d);
    else if (d) safeHideDropdown();
  });
  document.addEventListener('mousedown', e => {
    const t = e.target as HTMLElement;
    if (!t.closest('#urlbar') && !t.closest('#suggestions')) safeHideDropdown();
  });
}
