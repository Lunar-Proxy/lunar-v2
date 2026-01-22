import { createIcons, icons } from 'lucide';

createIcons({ icons });
['astro:page-load', 'astro:after-swap'].forEach(evt => {
  document.addEventListener(evt, () => createIcons({ icons }));
});

const urlbar = document.getElementById('urlbar') as HTMLInputElement | null;
const quicklinks: Record<string, string> = {
  'lunar://settings': 'Settings',
  'lunar://new': 'New Page',
  'lunar://games': 'Games',
  'lunar://apps': 'Apps',
};

let debounce: number | null = null;
let menuopen = false;
let prevquery = '';

function isquicklink(str: string): boolean {
  return str.startsWith('lunar://');
}

function getquicklinks(str: string): [string, string][] {
  const lc = str.toLowerCase();
  return Object.entries(quicklinks).filter(([k]) => k.toLowerCase().includes(lc));
}

async function fetchsuggestions(query: string): Promise<string[]> {
  if (!query) return [];
  try {
    const resp = await fetch(`/api/query?q=${encodeURIComponent(query)}`);
    if (!resp.ok) return [];
    const json = await resp.json();
    return Array.isArray(json.suggestions) ? json.suggestions : [];
  } catch {
    return [];
  }
}

function ismathquery(str: string): boolean {
  const normalized = str.trim().replace(/x/gi, '*');
  return /^[0-9+\-*/().%^√\s]+$/.test(normalized) && 
         !/^[0-9.]+$/.test(normalized) && 
         /[+\-*/%^√()]/.test(normalized);
}

function evalmath(str: string): string | null {
  try {
    const expression = str
      .replace(/x/gi, '*')
      .replace(/√(\d+)/g, 'Math.sqrt($1)')
      .replace(/√/g, 'Math.sqrt')
      .replace(/\^/g, '**')
      .replace(/(\d+)%/g, '($1/100)');
    const answer = Function('"use strict";return(' + expression + ')')();
    return typeof answer === 'number' && isFinite(answer) ? String(answer) : null;
  } catch {
    return null;
  }
}

function createdropdown(): HTMLDivElement {
  closemenu();
  const menu = document.createElement('div');
  menu.id = 'suggestions';
  menu.className = 'absolute top-full z-50 mt-0 w-full rounded-b-xl border-x border-b border-[#3a3758] bg-[#1f1f30]/95 shadow-2xl backdrop-blur-xl transition-all duration-200 overflow-y-auto opacity-0 hidden';
  urlbar?.parentElement?.appendChild(menu);
  return menu;
}

function openmenu(menu: HTMLDivElement): void {
  if (!urlbar?.value.trim()) {
    closemenu();
    return;
  }
  menu.classList.remove('opacity-0', 'hidden');
  const bounds = urlbar.getBoundingClientRect();
  const maxheight = window.innerHeight - bounds.bottom - 16;
  menu.style.maxHeight = `${Math.max(maxheight, 100)}px`;
}

function closemenu(): void {
  document.getElementById('suggestions')?.remove();
  menuopen = false;
}

function selectitem(value: string): void {
  if (!urlbar) return;
  urlbar.value = value;
  closemenu();
  urlbar.dispatchEvent(new KeyboardEvent('keydown', { 
    key: 'Enter', 
    code: 'Enter',
    keyCode: 13,
    bubbles: true,
    cancelable: true
  }));
}

function htmlescape(text: string): string {
  const temp = document.createElement('div');
  temp.textContent = text;
  return temp.innerHTML;
}

function rendermenu(suggestions: string[], quickmatches: [string, string][], mathresult: string | null, searchquery: string): void {
  closemenu();
  if (!urlbar?.value.trim()) return;
  
  const trimmed = suggestions.slice(0, 7);
  const showquick = isquicklink(searchquery);
  
  if (!trimmed.length && !quickmatches.length && !mathresult) return;
  
  const dropdown = createdropdown();
  const markup: string[] = [];
  
  if (mathresult) {
    markup.push(`<div class="flex items-center space-x-3 px-4 py-3 text-(--text-header) cursor-pointer hover:bg-[#2a293f] transition-colors" data-value="${htmlescape(mathresult)}"><i data-lucide="calculator" class="h-5 w-5 text-green-400"></i><span>${htmlescape(mathresult)}</span></div>`);
  }
  
  if (trimmed.length) {
    markup.push(`<div class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">Suggestions for <span class="text-white">"${htmlescape(searchquery)}"</span></div>`);
    trimmed.forEach(sug => {
      markup.push(`<div class="flex items-center space-x-3 px-4 py-3 text-(--text-header) cursor-pointer hover:bg-[#2a293f] transition-colors" data-value="${htmlescape(sug)}"><i data-lucide="search" class="h-4 w-4 text-(--text-secondary)"></i><span>${htmlescape(sug)}</span></div>`);
    });
  }
  
  if (showquick && quickmatches.length) {
    markup.push(`<div class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary) border-t border-[#3a3758]">Lunar Links</div>`);
    quickmatches.forEach(([link, desc]) => {
      markup.push(`<div class="flex items-center justify-between px-4 py-3 text-(--text-header) cursor-pointer hover:bg-[#2a293f] transition-colors" data-value="${htmlescape(link)}"><div class="flex items-center space-x-3"><i data-lucide="globe" class="h-5 w-5 text-purple-400"></i><span>${htmlescape(link)}</span></div><span class="text-xs text-(--text-secondary)">${htmlescape(desc)}</span></div>`);
    });
  }
  
  dropdown.innerHTML = markup.join('');
  dropdown.querySelectorAll<HTMLElement>('[data-value]').forEach(elem => {
    elem.addEventListener('click', evt => {
      evt.preventDefault();
      evt.stopPropagation();
      const val = elem.dataset.value;
      if (val) selectitem(val);
    });
  });
  createIcons({ icons });
  openmenu(dropdown);
  menuopen = true;
}

async function updatemenu(): Promise<void> {
  if (!urlbar) return;
  const current = urlbar.value.trim();
  if (!current) {
    closemenu();
    return;
  }
  prevquery = current;
  const [suggestions, mathans] = await Promise.all([
    fetchsuggestions(current),
    ismathquery(current) ? evalmath(current) : Promise.resolve(null),
  ]);
  if (urlbar.value.trim() !== prevquery) return;
  const quickres = isquicklink(current) ? getquicklinks(current) : [];
  rendermenu(suggestions, quickres, mathans, current);
}

function scheduleupdate(): void {
  if (debounce) clearTimeout(debounce);
  debounce = window.setTimeout(() => {
    if (!urlbar?.value.trim()) {
      closemenu();
      return;
    }
    updatemenu();
  }, 150);
}

function handleblur(): void {
  if (debounce) {
    clearTimeout(debounce);
    debounce = null;
  }
  setTimeout(() => closemenu(), 150);
}

if (urlbar) {
  urlbar.addEventListener('input', scheduleupdate);
  urlbar.addEventListener('focus', () => {
    if (urlbar.value.trim()) updatemenu();
  });
  urlbar.addEventListener('blur', handleblur);
  urlbar.addEventListener('keydown', evt => {
    if (evt.key === 'Escape') {
      evt.preventDefault();
      closemenu();
    } else if (evt.key === 'Enter') {
      closemenu();
    }
  });
  
  window.addEventListener('resize', () => {
    const dropdown = document.getElementById('suggestions') as HTMLDivElement | null;
    if (dropdown && menuopen && urlbar?.value.trim()) {
      openmenu(dropdown);
    } else if (dropdown) {
      closemenu();
    }
  });
  
  document.addEventListener('mousedown', evt => {
    const target = evt.target as HTMLElement;
    if (!target.closest('#urlbar') && !target.closest('#suggestions')) closemenu();
  });
  
  document.addEventListener('mousedown', evt => {
    const target = evt.target as HTMLElement;
    if (target.closest('#suggestions')) evt.preventDefault();
  }, true);
}